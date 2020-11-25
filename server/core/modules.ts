/*
 * Copyright Strimzi authors.
 * License: Apache License 2.0 (see the file LICENSE or http://apache.org/licenses/LICENSE-2.0.html).
 */
import { ApiModule } from 'api/index';
import { ClientModule } from 'client/index';
import { ConfigModule } from 'config/index';
import { LogModule } from 'log/index';
import { MockApiModule } from 'mockapi/index';

import { generateLogger } from 'logging';
import { serverConfigType, UIServerModule } from 'types';

const logger = generateLogger('Core.modules');

const availableModules: Array<UIServerModule> = [
  ApiModule,
  ClientModule,
  ConfigModule,
  LogModule,
  MockApiModule,
].map((module) => ({ ...module }));

export const getModules: (
  config: serverConfigType
) => Array<UIServerModule> = ({ modules }) => {
  const enabledModulesFromConfig = Object.entries(modules)
    .filter(([, enabled]) => enabled === true)
    .map(([moduleName]) => moduleName);

  if (
    enabledModulesFromConfig.includes(ApiModule.moduleName) &&
    enabledModulesFromConfig.includes(MockApiModule.moduleName)
  ) {
    logger.debug(
      `Both 'api' and 'mockapi' modules were enabled. This is not permitted. Enabling 'api' module only.`
    );
    // remove mock api if mock api and api enabled
    enabledModulesFromConfig.splice(
      enabledModulesFromConfig.indexOf(MockApiModule.moduleName),
      1
    );
  }

  return availableModules.filter(({ moduleName }) =>
    enabledModulesFromConfig.includes(moduleName)
  );
};
