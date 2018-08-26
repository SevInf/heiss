import yargs from 'yargs';
import { Server } from './server';

yargs
    .command(
        '$0 <directory>',
        'Serve static files from provided directory',
        args => {
            return args
                .positional('directory', {
                    describe: 'Directory to serve files from'
                })
                .option('port', {
                    type: 'number',
                    default: 8080,
                    describe: 'A port to listen on'
                })
                .option('host', {
                    default: 'localhost',
                    describe: 'A host to listen on'
                });
        },
        (args: yargs.Arguments) => {
            const server = new Server({
                host: args.host,
                port: args.port,
                directory: args.directory
            });
            server.start();
        }
    )
    .parse();
