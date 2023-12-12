import path, { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import fse from 'fs-extra';
import * as _ from 'lodash-es';
import { expect } from 'esmocha';

import { execaCommandSync } from 'execa';
import { packageJson } from '../../lib/index.js';
import { GENERATOR_APP, GENERATOR_UPGRADE } from '../generator-list.js';
import { basicHelpers as helpers, getGenerator, result as runResult } from '../../test/support/index.js';

const { escapeRegExp } = _;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('generator - upgrade', function () {
  describe('default application', () => {
    before(async () => {
      await helpers
        .runJHipster(GENERATOR_APP)
        .withJHipsterConfig({
          skipClient: true,
          skipServer: true,
          baseName: 'upgradeTest',
        })
        .withOptions({ useVersionPlaceholders: false });
      await runResult
        .create(getGenerator(GENERATOR_UPGRADE))
        .withOptions({
          regenerateExecutable: resolve(__dirname, '../../bin/jhipster.cjs'),
          force: true,
          silent: false,
          targetVersion: packageJson.version,
          useVersionPlaceholders: false,
        })
        .run();
    });

    it('generated git commits to match snapshot', () => {
      const commits = execaCommandSync('git log --pretty=format:%s', { stdio: 'pipe', reject: false }).stdout;
      expect(commits.replace(new RegExp(escapeRegExp(packageJson.version), 'g'), 'VERSION')).toMatchInlineSnapshot(`
"Merge branch 'jhipster_upgrade'
Generated with JHipster VERSION
Merge branch 'jhipster_upgrade'
Generated with JHipster undefined
Initial version of upgradeTest generated by generator-jhipster@undefined"
`);
    });

    it('generates expected number of commits', () => {
      const commitsCount = execaCommandSync('git rev-list --count HEAD', { stdio: 'pipe', reject: false }).stdout.replace('\n', '');
      // Expecting 5 commits in history (because we used `force` option):
      //   - master: initial commit
      //   - jhipster_upgrade; initial generation
      //   - master: block-merge commit of jhipster_upgrade
      //   - jhipster_upgrade: new generation in jhipster_upgrade
      //   - master: merge commit of jhipster_upgrade
      expect(commitsCount).toBe('5');
    });
  });
  describe.skip('blueprint application', () => {
    const blueprintName = 'generator-jhipster-sample-blueprint';
    const blueprintVersion = '0.1.1';
    before(async () => {
      await helpers.prepareTemporaryDir();
      const dir = process.cwd();
      /* eslint-disable-next-line no-console */
      console.log(`Generating JHipster application in directory: ${dir}`);
      // Fake the presence of the blueprint in node_modules: we don't install it, but we need its version
      const packagejs = {
        name: blueprintName,
        version: blueprintVersion,
      };
      const fakeBlueprintModuleDir = path.join(dir, `node_modules/${blueprintName}`);
      fse.ensureDirSync(path.join(fakeBlueprintModuleDir, 'generators', 'fake'));
      fse.writeJsonSync(path.join(fakeBlueprintModuleDir, 'package.json'), packagejs);
      // Create an fake generator, otherwise env.lookup doesn't find it.
      fse.writeFileSync(path.join(fakeBlueprintModuleDir, 'generators', 'fake', 'index.js'), '');
      return helpers
        .create(path.join(__dirname, '../generators/app/index.js'), { tmpdir: false })
        .withJHipsterConfig({
          skipClient: true,
          skipServer: true,
          baseName: 'upgradeTest',
        })
        .withOptions({
          blueprints: blueprintName,
        })
        .run()
        .then(() => {
          return helpers
            .create(path.join(__dirname, '../generators/upgrade/index.js'), { tmpdir: false })
            .withOptions({
              force: true,
              silent: false,
              targetVersion: packageJson.version,
            })
            .run();
        });
    });

    it('generated git commits to match snapshot', () => {
      const commits = execaCommandSync('git log --pretty=format:%s', { stdio: 'pipe', reject: false }).stdout;
      expect(commits.replace(new RegExp(escapeRegExp(packageJson.version), 'g'), 'VERSION')).toMatchInlineSnapshot(`
`);
    });

    it('generates expected number of commits', () => {
      const commitsCount = execaCommandSync('git rev-list --count HEAD', { stdio: 'pipe', reject: false }).stdout.replace('\n', '');
      // Expecting 5 commits in history (because we used `force` option):
      //   - master: initial commit
      //   - jhipster_upgrade; initial generation
      //   - master: block-merge commit of jhipster_upgrade
      //   - jhipster_upgrade: new generation in jhipster_upgrade
      //   - master: merge commit of jhipster_upgrade
      expect(commitsCount).toBe('5');
    });

    it('still contains blueprint information', () => {
      runResult.assertJsonFileContent('.yo-rc.json', {
        'generator-jhipster': { blueprints: [{ name: blueprintName, version: blueprintVersion }] },
      });
      runResult.assertFileContent('package.json', new RegExp(`"${blueprintName}": "${blueprintVersion}"`));
    });
  });
});