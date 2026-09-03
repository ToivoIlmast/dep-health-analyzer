import { defaultConfig } from './defaultConfig';

describe('defaultConfig', () => {
    it('should point $schema at an absolute URL, not a path relative to this repo', () => {
        // This file is copied verbatim into every user's generated config via
        // --init. A repo-relative path (e.g. './src/app/config/config.schema.json')
        // only resolves inside dep-health's own repository - it doesn't exist
        // for anyone who installed the package from npm.
        expect(defaultConfig.$schema).toMatch(/^https:\/\//);
        expect(defaultConfig.$schema).not.toMatch(/^\./);
    });
});
