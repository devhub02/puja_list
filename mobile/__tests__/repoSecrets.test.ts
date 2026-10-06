import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Guards the repository itself: signing keys, Firebase/Google service files and real AdMob ids must
 * never be tracked by git. Runs `git ls-files`, so it checks what is committed, not what is on disk.
 */
const REPO_ROOT = join(__dirname, '..', '..');
const GOOGLE_TEST_PUBLISHER_ID = '3940256099942544';
const PUBLISHER_ID_PATTERN = /ca-app-pub-(\d{16})/g;
const FORBIDDEN_NAME = /\.(keystore|jks)$|(^|\/)google-services\.json$/i;
const BINARY_EXTENSIONS = /\.(png|jpe?g|webp|gif|ico|ttf|otf|woff2?|mp3|mp4|wav|zip|gz|hbc|bin)$/i;

function trackedFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return output.split('\0').filter(Boolean);
}

describe('repository secrets guard', () => {
  const files = trackedFiles();

  it('lists tracked files (git is available and the repo is a checkout)', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('tracks no keystore, jks or google-services.json file', () => {
    expect(files.filter((f) => FORBIDDEN_NAME.test(f))).toEqual([]);
  });

  it('tracks no real AdMob publisher id (only Google’s test publisher id is allowed)', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (BINARY_EXTENSIONS.test(file)) continue;
      const buffer = readFileSync(join(REPO_ROOT, file));
      if (buffer.subarray(0, 8000).includes(0)) continue; // binary content
      const text = buffer.toString('utf8');
      let match: RegExpExecArray | null;
      PUBLISHER_ID_PATTERN.lastIndex = 0;
      while ((match = PUBLISHER_ID_PATTERN.exec(text)) !== null) {
        if (match[1] !== GOOGLE_TEST_PUBLISHER_ID) offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
