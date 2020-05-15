import {Module} from '@nestjs/common';
import {IWebModuleConfig, WebModule} from '@relate/web';
import {SystemModule, loadExtensionsFor, EXTENSION_TYPES} from '@relate/common';

import {WindowModule} from './window';

export interface IElectronModuleConfig extends IWebModuleConfig {
    defaultApp: string;
}

const dynamicModules = loadExtensionsFor(EXTENSION_TYPES.ELECTRON);

@Module({
    imports: [SystemModule, WebModule, ...dynamicModules, WindowModule],
    providers: [],
})
export class ElectronModule {}
