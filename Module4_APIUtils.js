// ============================================
// Module4_APIUtils.gs  (Refactored / Hardened)
// - Unified OpenAI chat call with retries/backoff
// - Optional JSON-only responses (forceJson)
// - Optional cache-bypass (noCache)
// - Small response cache to cut costs/latency
// - Safe stringification to avoid "[object Object]"
// - API key setup + validation + connection test
// ============================================


const APIUtils = {
  OPENAI_ENDPOINT: 'https://api.openai.com/v1/chat/completions',
  MAX_RETRIES: (GRANT_CONFIG && GRANT_CONFIG.OPENAI && GRANT_CONFIG.OPENAI.MAX_RETRIES) ? GRANT_CONFIG.OPENAI.MAX_RETRIES : 3,
  DEFAULT_MODEL: (GRANT_CONFIG && GRANT_CONFIG.OPENAI && GRANT_CONFIG.OPENAI.MODEL) ? GRANT_CONFIG.OPENAI.MODEL : 'gpt-4o-mini',
  _CACHE: CacheService.getScriptCache(),


  /**
   * Primary entry point used by other modules.
   * Returns { success, data, attempts, cached? }
   *
   * options:
   *  - model        : string
   *  - temperature  : number
   *  - maxTokens    : number
   *  - forceJson    : boolean => adds response_format: {type: 'json_object'}
   *  - noCache      : boolean => skip using/storing cache
   */
  callOpenAI(prompt, options) {
    options = options || {};
    const useCache = !options.noCache;


    // Build a cache key from prompt + flags that affect output
    const cacheKey = 'openai:' + Utilities.base64EncodeWebSafe(
      JSON.stringify({
        p: String(prompt).slice(0, 4000), // keep key size sane
        m: options.model || this.DEFAULT_MODEL,
        t: options.temperature ?? GRANT_CONFIG.OPENAI.TEMPERATURE,
        mx: options.maxTokens ?? GRANT_CONFIG.OPENAI.MAX_TOKENS,
        fj: !!options.forceJson
      })
    ).slice(0, 200); // cache key limit


    if (useCache) {
      try {
        const cached = this._CACHE.get(cacheKey);
        if (cached) {
          return { success: true, data: cached, attempts: 0, cached: true };
        }
      } catch (e) {
        // Cache errors are non-fatal
        Logger.log(`⚠️ Cache get error: ${e.message}`);
      }
    }


    const maxRetries = Math.max(1, this.MAX_RETRIES);
    const rateDelay = (GRANT_CONFIG && GRANT_CONFIG.OPENAI && GRANT_CONFIG.OPENAI.RATE_LIMIT_DELAY) ? GRANT_CONFIG.OPENAI.RATE_LIMIT_DELAY : 2000;


    // Use CoreUtils.executeWithRetry correctly (pass a function)
    const result = CoreUtils.executeWithRetry(
      'OpenAI API Call',
      function () {
        return APIUtils.callOpenAIInternal(prompt, options || {});
      },
      maxRetries,
      rateDelay
    );


    // Store in cache if we have a good string payload
    if (useCache && result && result.success && result.data) {
      try {
        // Avoid caching literal "[object Object]"
        const val = (typeof result.data === 'string') ? result.data : JSON.stringify(result.data);
        if (val && val !== '[object Object]') {
          // 10 minutes
          APIUtils._CACHE.put(cacheKey, val, 60 * 10);
        }
      } catch (e) {
        Logger.log(`⚠️ Cache put error: ${e.message}`);
      }
    }


    return result;
  },


  /**
   * Low-level call. Throws on HTTP errors so executeWithRetry can retry.
   * Returns { success: true, data: <string> }
   */
  callOpenAIInternal(prompt, options) {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please run setupOpenAIKey().');
    }
    if (!this.validateApiKey(apiKey)) {
      throw new Error('OpenAI API key format appears invalid.');
    }


    const model = options.model || this.DEFAULT_MODEL;
    const temperature = (options.temperature !== undefined ? options.temperature : GRANT_CONFIG.OPENAI.TEMPERATURE);
    const maxTokens = (options.maxTokens !== undefined ? options.maxTokens : GRANT_CONFIG.OPENAI.MAX_TOKENS);
    const forceJson = !!options.forceJson;


    const payload = {
      model: model,
      messages: [{ role: 'user', content: String(prompt) }],
      temperature: temperature,
      max_tokens: maxTokens
    };


    // If caller wants strict JSON, ask the API to enforce it
    if (forceJson) {
      payload.response_format = { type: 'json_object' };
    }


    const params = {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'User-Agent': 'ElevatedMovements-GrantManager/1.1'
      },
      payload: JSON.stringify(payload)
    };


    const res = UrlFetchApp.fetch(this.OPENAI_ENDPOINT, params);
    const code = res.getResponseCode();
    const text = res.getContentText();


    // 2xx okay
    if (code >= 200 && code < 300) {
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        // If response isn't JSON (shouldn’t happen), return raw text
        return { success: true, data: String(text) };
      }


      // Extract the message content safely
      const content = this._safeChoiceContent(json);
      const out = (typeof content === 'string') ? content : JSON.stringify(content);


      if (!out || !String(out).trim()) {
        throw new Error('Empty response from OpenAI.');
      }
      return { success: true, data: String(out).trim() };
    }


    // Retryable statuses
    if (code === 429 || (code >= 500 && code <= 599)) {
      throw new Error(`OpenAI temporary error (${code}).`);
    }


    // Non-retryable (auth, bad request, etc.)
    throw new Error(`OpenAI API error (${code}): ${text}`);
  },


  /**
   * Optional direct JSON call with explicit payload (not widely used by modules).
   * Returns parsed JSON on 200, throws otherwise.
   */
  callOpenAIWithBackoff(payload) {
    const apiKey = getOpenAIApiKey();
    if (!apiKey) throw new Error('OpenAI API key not configured.');


    let retries = 0;
    const max = Math.max(1, this.MAX_RETRIES);


    while (retries < max) {
      try {
        const res = UrlFetchApp.fetch(this.OPENAI_ENDPOINT, {
          method: 'POST',
          contentType: 'application/json',
          headers: { 'Authorization': 'Bearer ' + apiKey },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        });


        const code = res.getResponseCode();
        const text = res.getContentText();


        if (code === 200) {
          return JSON.parse(text);
        }
        Logger.log(`⚠️ OpenAI call failed (Status ${code}): ${text}`);
        if (code === 429 || (code >= 500 && code <= 599)) {
          throw new Error('Retryable error');
        }
        // non-retryable:
        throw new Error(`OpenAI API Error ${code}: ${text}`);


      } catch (err) {
        retries++;
        const backoff = Math.pow(2, retries) * 1000;
        Logger.log(`🔄 Retry ${retries}/${max} after ${Math.round(backoff / 1000)}s: ${err.message}`);
        if (retries < max) Utilities.sleep(backoff);
      }
    }


    throw new Error('❌ OpenAI call failed after maximum retries.');
  },


  /**
   * Extract the first message.content safely from an OpenAI chat response.
   */
  _safeChoiceContent(json) {
    try {
      const c = json && json.choices && json.choices[0] && json.choices[0].message
        ? json.choices[0].message.content
        : null;
      return (typeof c === 'string') ? c : (c ? JSON.stringify(c) : '');
    } catch (_) {
      return '';
    }
  },


  /**
   * Prompt user to store API key in Script Properties.
   */
  setupOpenAIKey() {
    const ui = SpreadsheetApp.getUi();
    const resp = ui.prompt(
      'Setup OpenAI API Key',
      'Enter your OpenAI API key (stored securely in Script Properties).\n\n' +
      'Get a key at: https://platform.openai.com/api-keys',
      ui.ButtonSet.OK_CANCEL
    );


    if (resp.getSelectedButton() !== ui.Button.OK) return;


    const key = (resp.getResponseText() || '').trim();
    if (!key) {
      ui.alert('❌ Invalid', 'No key entered.', ui.ButtonSet.OK);
      return;
    }


    if (!this.validateApiKey(key)) {
      ui.alert('❌ Invalid Key', 'The API key format looks wrong. Please double-check and try again.', ui.ButtonSet.OK);
      return;
    }


    try {
      PropertiesService.getScriptProperties().setProperty('OPENAI_API_KEY', key);
      ui.alert('✅ Success', 'API key stored successfully. You are ready to use AI features.', ui.ButtonSet.OK);
      CoreUtils.logSystemEvent('API Key Setup', 'Success', 'API key configured');
    } catch (e) {
      ui.alert('❌ Storage Error', 'Failed to store API key: ' + e.message, ui.ButtonSet.OK);
    }
  },


  /**
   * Basic key format validation (not an online check).
   */
  validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') return false;
    const key = apiKey.trim();


    // Accept common OpenAI formats (not exhaustive—intentionally permissive)
    const validFormats = [
      /^sk-[A-Za-z0-9]{32,}$/,
      /^sk-proj-[A-Za-z0-9]{24,}$/,
      /^sk-[A-Za-z0-9\-_]{20,200}$/
    ];


    const matches = validFormats.some(rx => rx.test(key));
    const lenOk = key.length >= 32 && key.length <= 200;
    return matches && lenOk;
  },


  /**
   * Very small health check. Returns { success, message | error }.
   */
  testConnection() {
    try {
      const res = this.callOpenAI('Respond with exactly "API_TEST_SUCCESS"', {
        temperature: 0,
        maxTokens: 10,
        noCache: true
      });


      if (res && res.success) {
        const body = (typeof res.data === 'string') ? res.data : JSON.stringify(res.data);
        if (String(body).indexOf('API_TEST_SUCCESS') !== -1) {
          return { success: true, message: 'Connection successful' };
        }
        return { success: false, error: 'Unexpected response content' };
      }
      return { success: false, error: res && res.error ? res.error : 'Unknown error' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
};
