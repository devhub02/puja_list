/**
 * Release configuration for the Android app (runs on every `expo prebuild`, so `android/` can stay
 * git-ignored and be regenerated):
 *
 * 1. Release signing reads the keystore and passwords ONLY from Gradle properties (set in
 *    ~/.gradle/gradle.properties or with -P). Nothing secret is written to the repo.
 * 2. A release build (assembleRelease / bundleRelease) FAILS with a clear message when those
 *    properties are missing. It never falls back to the debug key.
 * 3. R8 minification and resource shrinking are enabled for release builds.
 *
 * Variable names and setup: docs/RELEASE.md.
 */
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const MARK = 'puja-release-signing';
const PROPS = [
  'PUJA_RELEASE_STORE_FILE',
  'PUJA_RELEASE_STORE_PASSWORD',
  'PUJA_RELEASE_KEY_ALIAS',
  'PUJA_RELEASE_KEY_PASSWORD',
];

const RELEASE_SIGNING_CONFIG = `
        release {
            // ${MARK}: values come only from Gradle properties (~/.gradle/gradle.properties or -P).
            storeFile findProperty('PUJA_RELEASE_STORE_FILE') ? file(findProperty('PUJA_RELEASE_STORE_FILE')) : null
            storePassword findProperty('PUJA_RELEASE_STORE_PASSWORD')
            keyAlias findProperty('PUJA_RELEASE_KEY_ALIAS')
            keyPassword findProperty('PUJA_RELEASE_KEY_PASSWORD')
        }
`;

const FAIL_FAST = `
// ${MARK}: a release build must never be signed with the debug key. Fail before compiling if the
// signing properties are missing or the keystore file does not exist.
gradle.taskGraph.whenReady { graph ->
    def releaseRequested = graph.allTasks.any { it.name ==~ /(assemble|bundle)Release/ }
    if (releaseRequested) {
        def missing = ${JSON.stringify(PROPS)}.findAll { !findProperty(it) }
        if (missing) {
            throw new GradleException("Release signing is not configured. Missing Gradle properties: " + missing.join(', ') + ". See docs/RELEASE.md.")
        }
        def store = file(findProperty('PUJA_RELEASE_STORE_FILE'))
        if (!store.exists()) {
            throw new GradleException("Release keystore not found at " + store.absolutePath + " (PUJA_RELEASE_STORE_FILE). See docs/RELEASE.md.")
        }
    }
}
`;

function applySigning(contents) {
  if (contents.includes(MARK)) return contents;
  const debugBlock = /(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n {8}\}\n)/;
  if (!debugBlock.test(contents))
    throw new Error('withPujaRelease: could not find signingConfigs.debug in app/build.gradle');
  let out = contents.replace(debugBlock, (m) => m + RELEASE_SIGNING_CONFIG.slice(1));
  const releaseSigning =
    'signingConfig signingConfigs.debug\n            def enableShrinkResources';
  if (!out.includes(releaseSigning))
    throw new Error('withPujaRelease: release buildType signing line not found');
  out = out.replace(
    releaseSigning,
    'signingConfig signingConfigs.release\n            def enableShrinkResources',
  );
  return out + FAIL_FAST;
}

function setProperty(items, key, value) {
  const existing = items.find((item) => item.type === 'property' && item.key === key);
  if (existing) existing.value = value;
  else items.push({ type: 'property', key, value });
}

const withPujaRelease = (config) => {
  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
  config = withGradleProperties(config, (cfg) => {
    setProperty(cfg.modResults, 'android.enableMinifyInReleaseBuilds', 'true');
    setProperty(cfg.modResults, 'android.enableShrinkResourcesInReleaseBuilds', 'true');
    return cfg;
  });
  return config;
};

module.exports = withPujaRelease;
