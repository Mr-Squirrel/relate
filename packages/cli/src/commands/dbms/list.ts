import cli from 'cli-ux';

import {ListModule} from '../../modules/dbms/list.module';
import BaseCommand from '../../base.command';

export default class ListCommand extends BaseCommand {
    commandClass = ListCommand;

    commandModule = ListModule;

    static aliases = ['dbms:ls'];

    static flags = {
        ...cli.table.flags(),
    };
}
