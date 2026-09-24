// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applySigning } = require('../withReleaseSigning');

const GRADLE = `
android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}
`;

describe('withReleaseSigning', () => {
  it('adds a release signing config read from env and uses it for release builds', () => {
    const out: string = applySigning(GRADLE);
    expect(out).toContain('storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))');
    expect(out).toMatch(/debug \{\s*signingConfig signingConfigs\.debug/);
    expect(out).toContain(
      'signingConfig System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug'
    );
  });

  it('is idempotent', () => {
    const once = applySigning(GRADLE);
    expect(applySigning(once)).toBe(once);
  });

  it('never contains secrets', () => {
    expect(applySigning(GRADLE)).not.toMatch(/storePassword\s+['"]/);
  });
});
