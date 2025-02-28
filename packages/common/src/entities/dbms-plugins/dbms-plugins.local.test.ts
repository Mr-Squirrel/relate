import nock from 'nock';

import {TargetExistsError} from '../../errors';
import {IDbmsInfo, IDbmsPluginSource} from '../../models';
import {waitForDbmsToBeOnline} from '../../utils/dbmss';
import {dbQuery} from '../../utils/dbmss/system-db-query';
import {TestEnvironment, TEST_NEO4J_CREDENTIALS} from '../../utils/system';
import {NEO4J_PLUGIN_SOURCES_URL} from '../environments';

const PLUGIN_SOURCES_ORIGIN = new URL(NEO4J_PLUGIN_SOURCES_URL).origin;
const PLUGIN_SOURCES_PATHNAME = new URL(NEO4J_PLUGIN_SOURCES_URL).pathname;

const APOC_SOURCE: IDbmsPluginSource = {
    name: 'apoc',
    homepageUrl: 'https://github.com/neo4j-contrib/neo4j-apoc-procedures',
    versionsUrl: 'https://neo4j-contrib.github.io/neo4j-apoc-procedures/versions.json',
};

const TEST_SOURCE: IDbmsPluginSource = {
    name: 'test-plugin-1',
    homepageUrl: 'https://github.com/neo4j-contrib/test-plugin-1',
    versionsUrl: 'https://neo4j-contrib.github.io/test-plugin-1/versions.json',
};

const TEST_SOURCE_2: IDbmsPluginSource = {
    name: 'test-plugin-2',
    homepageUrl: 'https://github.com/neo4j-contrib/test-plugin-2',
    versionsUrl: 'https://neo4j-contrib.github.io/test-plugin-2/versions.json',
};

describe('LocalDbmsPlugins', () => {
    let app: TestEnvironment;
    let dbms: IDbmsInfo;

    beforeAll(async () => {
        app = await TestEnvironment.init(__filename);
        dbms = await app.createDbms();
    });

    afterEach(() => nock.cleanAll());

    afterAll(() => app.teardown());

    test('dbmsPlugins.listSources - no plugin sources', async () => {
        nock(PLUGIN_SOURCES_ORIGIN)
            .get(PLUGIN_SOURCES_PATHNAME)
            .reply(200, {});

        const pluginSourcesNoDefaults = await app.environment.dbmsPlugins.listSources();
        expect(pluginSourcesNoDefaults.toArray()).toEqual([]);

        nock(PLUGIN_SOURCES_ORIGIN)
            .get(PLUGIN_SOURCES_PATHNAME)
            .reply(500);

        const pluginSourcesFetchError = await app.environment.dbmsPlugins.listSources();
        expect(pluginSourcesFetchError.toArray()).toEqual([]);
    });

    test('dbmsPlugins.listSources - default plugin sources', async () => {
        const pluginSources = await app.environment.dbmsPlugins.listSources();
        expect(pluginSources.toArray()).toContainEqual({
            ...APOC_SOURCE,
            isOfficial: true,
        });
    });

    test('dbmsPlugins.addSources - fails when adding an already existing source', async () => {
        const addedSources = app.environment.dbmsPlugins.addSources([APOC_SOURCE]);
        await expect(addedSources).rejects.toThrowError(
            new TargetExistsError(`The following dbms plugin sources already exist: apoc`),
        );

        const listedSources = await app.environment.dbmsPlugins.listSources();
        expect(listedSources.toArray()).toContainEqual({
            ...APOC_SOURCE,
            isOfficial: true,
        });
    });

    test('dbmsPlugins.addSources', async () => {
        const addedSources = await app.environment.dbmsPlugins.addSources([TEST_SOURCE]);
        const listedSources = await app.environment.dbmsPlugins.listSources();

        const expectedSource = {
            ...TEST_SOURCE,
            isOfficial: false,
        };
        expect(addedSources.toArray()).toEqual([expectedSource]);
        expect(listedSources.toArray()).toContainEqual(expectedSource);
    });

    test('dbmsPlugins.addSources - isOfficial attribute is ignored when adding sources', async () => {
        const addedSources = await app.environment.dbmsPlugins.addSources([
            {
                ...TEST_SOURCE_2,
                // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
                // @ts-ignore
                isOfficial: true,
            },
        ]);
        const listedSources = await app.environment.dbmsPlugins.listSources();

        expect(addedSources.toArray()).toEqual([
            {
                ...TEST_SOURCE_2,
                isOfficial: false,
            },
        ]);
        expect(listedSources.toArray()).toContainEqual({
            ...TEST_SOURCE,
            isOfficial: false,
        });
        expect(listedSources.toArray()).toContainEqual({
            ...TEST_SOURCE_2,
            isOfficial: false,
        });
    });

    test('dbmsPlugins.removeSources - removes user added sources', async () => {
        const removedSources = await app.environment.dbmsPlugins.removeSources(['test-plugin-1', 'test-plugin-2']);
        const listedSources = await app.environment.dbmsPlugins.listSources();

        expect(removedSources.toArray()).toEqual([
            {
                ...TEST_SOURCE,
                isOfficial: false,
            },
            {
                ...TEST_SOURCE_2,
                isOfficial: false,
            },
        ]);
        expect(listedSources.toArray()).not.toContainEqual({
            ...TEST_SOURCE,
            isOfficial: false,
        });
        expect(listedSources.toArray()).not.toContainEqual({
            ...TEST_SOURCE_2,
            isOfficial: false,
        });
    });

    test('dbmsPlugins.removeSources - cannot remove default sources', async () => {
        const removedSources = await app.environment.dbmsPlugins.removeSources(['apoc']);
        const listedSources = await app.environment.dbmsPlugins.listSources();

        expect(removedSources.toArray()).toEqual([]);
        expect(listedSources.toArray()).toContainEqual({
            ...APOC_SOURCE,
            isOfficial: true,
        });
    });

    test('dbmsPlugins.install - installs apoc successfully', async () => {
        const installedVersion = await app.environment.dbmsPlugins.install([dbms.id], 'apoc');

        expect(installedVersion.toArray().length).toEqual(1);
        expect(installedVersion.toArray()[0].version.version).toEqual('4.0.0.17');

        await app.environment.dbmss.start([dbms.id]);
        await waitForDbmsToBeOnline({
            ...dbms,
            config: await app.environment.dbmss.getDbmsConfig(dbms.id),
        });

        const accessToken = await app.environment.dbmss.createAccessToken('tests', dbms.id, {
            credentials: TEST_NEO4J_CREDENTIALS,
            principal: 'neo4j',
            scheme: 'basic',
        });

        const [res] = await dbQuery(
            {
                database: 'neo4j',
                dbmsUser: 'neo4j',
                accessToken,
                dbmsId: dbms.id,
                environment: app.environment,
            },
            'RETURN apoc.version()',
        ).finally(() => app.environment.dbmss.stop([dbms.id]));

        expect(res.data).toEqual(['4.0.0.17']);
        expect(res.type).toEqual('RECORD');
    });

    test('dbmsPlugins.list - lists installed plugin', async () => {
        const plugins = await app.environment.dbmsPlugins.list(dbms.name);

        expect(
            plugins
                .mapEach((p) => ({
                    name: p.name,
                    homepageUrl: p.homepageUrl,
                    version: p.version.version,
                }))
                .toArray(),
        ).toEqual([
            {
                name: 'apoc',
                homepageUrl: 'https://github.com/neo4j-contrib/neo4j-apoc-procedures',
                version: '4.0.0.17',
            },
            {
                name: 'neo4j-jwt-addon',
                homepageUrl: undefined,
                version: '1.0.1',
            },
        ]);
    });

    test('dbmsPlugins.previewUpgrade - lists correct plugin versions', async () => {
        const upgradable = await app.environment.dbmsPlugins.previewUpgrade(dbms.name, '4.2.0');
        const upgradableMapped = upgradable.toArray().map((plugin) => ({
            name: plugin.installed.name,
            installed: plugin.installed.version.version,
            upgradable: plugin.upgradable?.version,
        }));

        expect(upgradableMapped).toEqual([
            {
                name: 'apoc',
                installed: '4.0.0.17',
                upgradable: '4.2.0.0',
            },
            {
                name: 'neo4j-jwt-addon',
                installed: '1.0.1',
                upgradable: undefined,
            },
        ]);
    });

    test('dbmsPlugins.uninstall - uninstalls apoc successfully', async () => {
        await app.environment.dbmsPlugins.uninstall([dbms.id], 'apoc');
        const plugins = await app.environment.dbmsPlugins.list(dbms.name);

        expect(
            plugins
                .mapEach((p) => ({
                    name: p.name,
                    homepageUrl: p.homepageUrl,
                    version: p.version.version,
                }))
                .toArray(),
        ).toEqual([
            {
                name: 'neo4j-jwt-addon',
                homepageUrl: undefined,
                version: '1.0.1',
            },
        ]);
    });

    test('dbmsPlugins.uninstall - does not fail if the plugin is not installed', async () => {
        await app.environment.dbmsPlugins.uninstall([dbms.id], 'nonexistent');
        const plugins = await app.environment.dbmsPlugins.list(dbms.name);

        expect(
            plugins
                .mapEach((p) => ({
                    name: p.name,
                    homepageUrl: p.homepageUrl,
                    version: p.version.version,
                }))
                .toArray(),
        ).toEqual([
            {
                name: 'neo4j-jwt-addon',
                homepageUrl: undefined,
                version: '1.0.1',
            },
        ]);
    });
});
