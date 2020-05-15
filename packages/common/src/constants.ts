export const JSON_FILE_EXTENSION = '.json';
export const DOWNLOADING_FILE_EXTENSION = '.rdownload';

export const DEFAULT_ENVIRONMENT_NAME = 'default';

export const RELATE_KNOWN_CONNECTIONS_FILE = 'known_connections';
export const DBMS_DIR_NAME = 'dbmss';
export const NEW_LINE = '\n';
export const PROPERTIES_SEPARATOR = '=';
// @todo: this should be generated when installing daedalus instance
export const JWT_INSTANCE_TOKEN_SALT = 'hello world!';
export const TWENTY_FOUR_HOURS_SECONDS = 24 * 60 * 60;

export const EXTENSION_DIR_NAME = 'extensions';
export const PACKAGE_JSON = 'package.json';
export const EXTENSION_MANIFEST = 'relate.manifest.json';
export const EXTENSION_MANIFEST_KEY = 'relate';
export const EXTENSION_INDEX_HTML = 'index.html';
export const EXTENSION_SHA_ALGORITHM = 'sha1';
export const EXTENSION_URL_PATH = 'https://neo.jfrog.io/artifactory/api/npm/npm-local-private/@relate-ext/';

export const LOCALHOST_IP_ADDRESS = '127.0.0.1';
export const BOLT_DEFAULT_PORT = ':7687';

export enum EXTENSION_TYPES {
    SYSTEM = 'SYSTEM',
    CLI = 'CLI',
    WEB = 'WEB',
    ELECTRON = 'ELECTRON',
    // TASK = 'TASK',
    STATIC = 'STATIC',
}

export enum EXTENSION_ORIGIN {
    CACHED = 'cached',
    ONLINE = 'online',
}

export enum DBMS_TLS_LEVEL {
    DISABLED = 'DISABLED',
    OPTIONAL = 'OPTIONAL',
    ENABLED = 'ENABLED',
}

export type Listener<T = any> = (eventData: T) => T | void;

export enum HOOK_EVENTS {
    ELECTRON_WINDOW_OPTIONS = 'ELECTRON_WINDOW_OPTIONS',
    ELECTRON_WINDOW_CREATED = 'ELECTRON_WINDOW_CREATED',
}
