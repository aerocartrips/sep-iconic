import pb from './pocketbaseClient';

export const API_SERVER_URL = '/hcgi/api';

const apiServerClient = {
    fetch: async (url, options = {}) => {
        const headers = { ...(options.headers || {}) };
        if (pb.authStore.token && !headers['x-pb-token'] && !headers['X-Pb-Token']) {
            headers['x-pb-token'] = pb.authStore.token;
        }
        return await window.fetch(API_SERVER_URL + url, { ...options, headers });
    }
};

export default apiServerClient;

export { apiServerClient };
