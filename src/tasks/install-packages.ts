import { TaskStep, Task, transitionTo } from "../util/task";
import * as ui from "./ui/install-packages";
import { InstallPackagesContext } from "./context/install-packages";
import { installPackages, getLatestVersions } from "../service/package-manager";
import { getPackageJson, writePackageJson, PackageJson } from "../util/js/config";
import { projectHasYarn } from "../util/package";

const addZeplinScripts = (packageJson: PackageJson): void => {
    packageJson.scripts = {
        ...packageJson.scripts,
        "zeplin-connect": "zeplin connect",
        "zeplin-connect-dev-mode": "zeplin connect --dev"
    };
};

const install: TaskStep<InstallPackagesContext> = async (ctx, task): Promise<void> => {
    const projectTypes = ctx.projectTypes || [];

    const plugins = projectTypes.reduce((p, c) => p.concat(c.installPackages || []), [] as string[]);

    ctx.installedPlugins = plugins;

    const packageNames = [
        "@zeplin/cli",
        ...plugins
    ];

    const packageNamesWithVersions = await getLatestVersions(packageNames);

    ctx.installedPackages = packageNamesWithVersions;

    let packageJson = await getPackageJson();

    const installGlobal = !packageJson;

    if (ctx.cliOptions.skipInstall) {
        ctx.skippedInstallingRequiredPackages = projectTypes.length > 0;
        if (packageJson) {
            packageJson.devDependencies = {
                ...packageJson.devDependencies,
                ...packageNamesWithVersions
            };
        }
        task.skip(ctx, ui.skippedInstallation);
    } else {
        await installPackages(packageNamesWithVersions, { installGlobal });
        ctx.installedGlobally = installGlobal;
        ctx.isYarn = projectHasYarn();

        if (packageJson) {
            packageJson = await getPackageJson();
        }
    }

    if (packageJson) {
        addZeplinScripts(packageJson);
        await writePackageJson(packageJson);
    }
};

export const installPackage = new Task<InstallPackagesContext>({
    steps: [
        install,
        transitionTo(ui.completed)
    ],
    initial: ui.initial
});
