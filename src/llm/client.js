const OpenAI = require('openai');

let _client = null;

function getLLMClient() {
    if (_client) return _client;

    const apiKey  = process.env.GITHUB_MODELS_API_KEY;
    const baseURL = process.env.GITHUB_MODELS_API_BASE || 'https://models.inference.ai.azure.com';

    if (!apiKey) {
        throw new Error('GITHUB_MODELS_API_KEY must be set to use LLM features');
    }

    _client = new OpenAI({ apiKey, baseURL });
    return _client;
}

module.exports = { getLLMClient };
