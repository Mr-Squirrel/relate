import gql from 'graphql-tag';
import {List} from '@relate/types';
import {IAuthToken} from '@huboneo/tapestry';

import {IDbms, IDbmsInfo, IDbmsVersion, DbmsManifestModel, IDbmsUpgradeOptions} from '../../models';

import {DbmssAbstract} from './dbmss.abstract';
import {NEO4J_EDITION, RemoteEnvironment} from '../environments';
import {ENTITY_TYPES, PUBLIC_GRAPHQL_METHODS} from '../../constants';
import {GraphqlError, InvalidConfigError, NotSupportedError} from '../../errors';
import {PropertiesFile} from '../../system/files';
import {IRelateFilter} from '../../utils/generic';
import {ManifestRemote} from '../manifest';

export class RemoteDbmss extends DbmssAbstract<RemoteEnvironment> {
    public readonly manifest = new ManifestRemote(this.environment, ENTITY_TYPES.DBMS, DbmsManifestModel, this.get);

    async updateConfig(dbmsId: string, properties: Map<string, string>): Promise<boolean> {
        const {data, errors}: any = await this.environment.graphql({
            query: gql`
                mutation UpdateDbmsConfig(
                    $environmentId: String,
                    $dbmsId: String!,
                    $properties: [[String!, String!]]!
                ) {
                    ${PUBLIC_GRAPHQL_METHODS.UPDATE_DBMS_CONFIG}(
                        environmentNameOrId: $environmentId,
                        dbmsId: $dbmsId,
                        properties: $properties
                    )
                }
            `,
            variables: {
                dbmsId,
                environmentNameOrId: this.environment.remoteEnvironmentId,
                properties: properties.entries(),
            },
        });

        if (errors) {
            throw new GraphqlError(
                'Unable to update dbms config',
                List.from<Error>(errors).mapEach(({message}) => message),
            );
        }

        return data[PUBLIC_GRAPHQL_METHODS.UPDATE_DBMS_CONFIG];
    }

    async versions(limited?: boolean, filters?: List<IRelateFilter> | IRelateFilter[]): Promise<List<IDbmsVersion>> {
        const {data, errors}: any = await this.environment.graphql({
            /* eslint-disable max-len */
            query: gql`
                query ListDbmsVersions (
                    $environmentId: String,
                    limited: Boolean,
                    $filters: [RelateSimpleFilter!]
                ) {
                    ${PUBLIC_GRAPHQL_METHODS.LIST_DBMS_VERSIONS}(environmentNameOrId: $environmentId, limited: $limited, filters: $filters) {
                        edition
                        version
                        origin
                    }
                }
            `,
            /* eslint-enable max-len */
            variables: {
                environmentNameOrId: this.environment.remoteEnvironmentId,
                limited,
                filters,
            },
        });

        if (errors) {
            throw new GraphqlError(
                'Unable to list dbms versions',
                List.from<Error>(errors).mapEach(({message}) => message),
            );
        }

        return data[PUBLIC_GRAPHQL_METHODS.LIST_DBMS_VERSIONS];
    }

    async install(
        name: string,
        version: string,
        edition: NEO4J_EDITION = NEO4J_EDITION.ENTERPRISE,
        credentials = '',
        overrideCache = false,
        limited = false,
    ): Promise<IDbmsInfo> {
        const {data, errors}: any = await this.environment.graphql({
            query: gql`
                mutation InstallDbms(
                    $environmentId: String
                    $name: String!
                    $credentials: String!
                    $version: String!
                    $edition: String!
                    $overrideCache: String,
                    $version: String,
                ) {
                    ${PUBLIC_GRAPHQL_METHODS.INSTALL_DBMS}(
                        environmentNameOrId: $environmentId
                        name: $name
                        credentials: $credentials
                        version: $version
                        edition: $edition
                        overrideCache: $overrideCache
                        limited: $limited
                    ) {
                        id
                        name
                        description
                        tags
                        connectionUri
                        status
                        version
                        edition
                    }
                }
            `,
            variables: {
                credentials,
                environmentNameOrId: this.environment.remoteEnvironmentId,
                name,
                version,
                edition,
                overrideCache,
                limited,
            },
        });

        if (errors) {
            throw new GraphqlError(
                'Unable to install dbms',
                List.from<Error>(errors).mapEach(({message}) => message),
            );
        }

        return data[PUBLIC_GRAPHQL_METHODS.INSTALL_DBMS];
    }

    upgrade(_dbmsId: string, _version: string, _options?: IDbmsUpgradeOptions): Promise<IDbmsInfo> {
        throw new NotSupportedError(`${RemoteDbmss.name} does not support upgrading DBMSs`);
    }

    link(_externalPath: string, _name: string): Promise<IDbmsInfo> {
        throw new NotSupportedError(`${RemoteDbmss.name} does not support linking DBMSs`);
    }

    async uninstall(name: string): Promise<IDbmsInfo> {
        const {data, errors}: any = await this.environment.graphql({
            query: gql`
                mutation UninstallDbms($environmentId: String, $name: String!) {
                    ${PUBLIC_GRAPHQL_METHODS.UNINSTALL_DBMS}(environmentNameOrId: $environmentId, name: $name) {
                        id
                        name
                        description
                        tags
                        connectionUri
                        status
                        version
                        edition
                    }
                }
            `,
            variables: {
                environmentNameOrId: this.environment.remoteEnvironmentId,
                name,
            },
        });

        if (errors) {
            throw new GraphqlError(
                'Unable to uninstall dbms',
                List.from<Error>(errors).mapEach(({message}) => message),
            );
        }

        return data[PUBLIC_GRAPHQL_METHODS.UNINSTALL_DBMS];
    }

    async get(nameOrId: string): Promise<IDbmsInfo> {
        const {data, errors}: any = await this.environment.graphql({
            query: gql`
                query GetDbms($environmentId: String, $nameOrId: String!) {
                    ${PUBLIC_GRAPHQL_METHODS.GET_DBMS}(environmentNameOrId: $environmentId, dbmsId: $nameOrId) {
                        id
                        name
                        description
                        tags
                        connectionUri
                        status
                        version
                        edition
                    }
                }
            `,
            variables: {
                environmentNameOrId: this.environment.remoteEnvironmentId,
                nameOrId,
            },
        });

        if (errors) {
            throw new GraphqlError(
                'Unable to get dbms',
                List.from<Error>(errors).mapEach(({message}) => message),
            );
        }

        const dbms = data[PUBLIC_GRAPHQL_METHODS.GET_DBMS];

        if (!this.environment.httpOrigin) {
            throw new InvalidConfigError('Remote Environments must specify an `httpOrigin`');
        }

        // @todo this is not 100% reliable as the DBMS might be hosted on a
        // different domain.
        const relateUrl = new URL(this.environment.httpOrigin);
        const connectionUri = new URL(dbms.connectionUri);
        connectionUri.hostname = relateUrl.hostname;

        return {
            ...dbms,
            connectionUri: connectionUri.toString(),
        };
    }

    async list(filters?: List<IRelateFilter> | IRelateFilter[]): Promise<List<IDbms>> {
        const {data, errors}: any = await this.environment.graphql({
            query: gql`
                query ListDbmss($environmentId: String, $filters: [RelateSimpleFilter!]) {
                    ${PUBLIC_GRAPHQL_METHODS.LIST_DBMSS}(environmentNameOrId: $environmentId, filters: $filters) {
                        id
                        name
                        description
                        tags
                        connectionUri
                    }
                }
            `,
            variables: {
                environmentNameOrId: this.environment.remoteEnvironmentId,
                filters,
            },
        });

        if (errors) {
            throw new GraphqlError(
                'Unable to list dbmss',
                List.from<Error>(errors).mapEach(({message}) => message),
            );
        }

        return List.from(data[PUBLIC_GRAPHQL_METHODS.LIST_DBMSS]);
    }

    async start(namesOrIds: string[]): Promise<List<string>> {
        const {data, errors}: any = await this.environment.graphql({
            query: gql`
                mutation StartDBMSSs($environmentId: String, $namesOrIds: [String!]!) {
                    ${PUBLIC_GRAPHQL_METHODS.START_DBMSS}(environmentNameOrId: $environmentId, dbmsIds: $namesOrIds)
                }
            `,
            variables: {
                environmentNameOrId: this.environment.remoteEnvironmentId,
                namesOrIds,
            },
        });

        if (errors) {
            throw new GraphqlError(
                'Unable to start dbmss',
                List.from<Error>(errors).mapEach(({message}) => message),
            );
        }

        return List.from(data[PUBLIC_GRAPHQL_METHODS.START_DBMSS]);
    }

    async stop(namesOrIds: string[]): Promise<List<string>> {
        const {data, errors}: any = await this.environment.graphql({
            query: gql`
                mutation StopDBMSSs($environmentId: String, $namesOrIds: [String!]!) {
                    ${PUBLIC_GRAPHQL_METHODS.STOP_DBMSS}(environmentNameOrId: $environmentId, dbmsIds: $namesOrIds)
                }
            `,
            variables: {
                environmentNameOrId: this.environment.remoteEnvironmentId,
                namesOrIds,
            },
        });

        if (errors) {
            throw new GraphqlError(
                'Unable to stop dbmss',
                List.from<Error>(errors).mapEach(({message}) => message),
            );
        }

        return List.from(data[PUBLIC_GRAPHQL_METHODS.STOP_DBMSS]);
    }

    async info(namesOrIds: string[]): Promise<List<IDbmsInfo>> {
        const {data, errors}: any = await this.environment.graphql({
            query: gql`
                query InfoDBMSs($environmentId: String, $namesOrIds: [String!]!) {
                    ${PUBLIC_GRAPHQL_METHODS.INFO_DBMSS}(environmentNameOrId: $environmentId, dbmsIds: $namesOrIds) {
                        id
                        name
                        description
                        tags
                        connectionUri
                        version
                        status
                        edition
                    }
                }
            `,
            variables: {
                environmentNameOrId: this.environment.remoteEnvironmentId,
                namesOrIds,
            },
        });

        if (errors) {
            throw new GraphqlError(
                'Unable to info dbmss',
                List.from<Error>(errors).mapEach(({message}) => message),
            );
        }

        return List.from(data[PUBLIC_GRAPHQL_METHODS.INFO_DBMSS]);
    }

    async createAccessToken(appName: string, dbmsNameOrId: string, authToken: IAuthToken): Promise<string> {
        const {data, errors}: any = await this.environment.graphql({
            query: gql`
                mutation AccessDBMS(
                    $environmentId: String
                    $dbmsNameOrId: String!
                    $authToken: AuthTokenInput!
                    $appName: String!
                ) {
                    ${PUBLIC_GRAPHQL_METHODS.CREATE_ACCESS_TOKEN}(
                        environmentNameOrId: $environmentId
                        dbmsId: $dbmsNameOrId
                        appName: $appName
                        authToken: $authToken
                    )
                }
            `,
            variables: {
                appName,
                authToken,
                dbmsNameOrId,
                environmentNameOrId: this.environment.remoteEnvironmentId,
            },
        });

        if (errors) {
            throw new GraphqlError(
                'Unable to create access token',
                List.from<Error>(errors).mapEach(({message}) => message),
            );
        }

        return data[PUBLIC_GRAPHQL_METHODS.CREATE_ACCESS_TOKEN];
    }

    getDbmsConfig(_dbmsId: string): Promise<PropertiesFile> {
        throw new NotSupportedError(`${RemoteDbmss.name} does not support getting DBMS config`);
    }

    clone(_id: string, _name: string): Promise<IDbmsInfo> {
        throw new NotSupportedError(`${RemoteDbmss.name} does not support cloning`);
    }
}
