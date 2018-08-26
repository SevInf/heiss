export type ModuleLoader = (url: string) => Promise<any>;
export type ModuleUpdater = (newExports: any) => void;
export type DisposeListener = () => void;

export type OptionalDisposeListener = DisposeListener | null | undefined;

export const enum ReloadResult {
    UPDATED = 'updated',
    UP_TO_DATE = 'up-to-date',
    FAILED = 'failed'
}

export interface IHotModule {
    markAsNonReloadable(): void;
    reload(mtime: number, loader: ModuleLoader, dispose?: OptionalDisposeListener): Promise<ReloadResult>;
}

export class HotModule implements IHotModule {
    url: string;
    private mtime: number = 0;
    private exportNames: string[];
    private isReloadable: boolean = true;
    private updateExports?: (newExports: any) => void;

    constructor(url: string, exportNames: string[], updateExports?: ModuleUpdater) {
        this.url = url;
        this.exportNames = exportNames;
        this.updateExports = updateExports;
    }

    markAsNonReloadable() {
        this.isReloadable = false;
    }

    async reload(mtime: number, loader: ModuleLoader, dispose?: OptionalDisposeListener): Promise<ReloadResult> {
        if (!this.isReloadable) {
            return ReloadResult.FAILED;
        }
        if (this.mtime >= mtime) {
            // already at the current or newer version
            return ReloadResult.UP_TO_DATE;
        }
        if (dispose) {
            dispose();
        }
        const updatedExports = await loader(`${this.url}?mtime=${mtime}`);
        if (exportsChanged(this.exportNames, Object.keys(updatedExports))) {
            return ReloadResult.FAILED;
        }
        if (typeof this.updateExports === 'function') {
            this.updateExports(updatedExports);
        }
        this.mtime = mtime;
        return ReloadResult.UPDATED;
    }
}

function exportsChanged(originalExports: string[], newExports: string[]): boolean {
    if (originalExports.length !== newExports.length) {
        return true;
    }
    return !originalExports.every(name => newExports.includes(name));
}
