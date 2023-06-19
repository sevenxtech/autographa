/* eslint-disable no-await-in-loop */
/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
import moment from 'moment';
import { v5 as uuidv5 } from 'uuid';
import localForage from 'localforage';
import Textburrito from '../../../lib/BurritoTemplete.json';
import OBSburrito from '../../../lib/OBSTemplete.json';
import languageCode from '../../../lib/LanguageCode.json';
import * as logger from '../../../logger';
import { environment } from '../../../../environment';
import packageInfo from '../../../../../package.json';
import customLicense from '../../../lib/license/Custom.md';
import OBSLicense from '../../../lib/OBSLicense.md';
import OBSData from '../../../lib/OBSData.json';
import supabase, { supabaseStorage } from '../../../../../supabase';

const md5 = require('md5');

const path = require('path');
const JSZip = require('jszip');

const findCode = (list, id) => {
  logger.debug('createDownloadedResourceSB.js', 'In findCode for getting the language code');
  let code = '';
  list.forEach((obj) => {
    if ((obj.name).toLowerCase() === id.toLowerCase()) {
      code = obj.lang_code;
    }
  });
  return code;
};
export const createDownloadedResourceSB = async (username, resourceMeta, projectResource, selectResource) => {
  logger.debug('createDownloadedResourceSB.js', 'Create Metadata for downloaded bible resource');
  // generate unique key
  try {
    const key = username + projectResource.name + projectResource.owner + moment().format();
    const id = uuidv5(key, environment.uuidToken);
    const localizedNames = {};
    // console.log('unique id : ', id);
    let json = {};
    switch (selectResource) {
      case 'bible':
        // json = { ...Textburrito };
        json = Textburrito;
        break;
      case 'obs':
        // json = { ...OBSburrito };
        json = OBSburrito;
        break;
      default:
        throw new Error(' can not process :Inavalid Type od Resource requested');
      // break;
    }
    return new Promise((resolve) => {
      json.meta.generator.userName = username;
      json.meta.generator.softwareName = 'Autographa';
      json.meta.generator.softwareVersion = packageInfo.version;
      json.meta.dateCreated = moment().format();
      json.idAuthorities = {
        dcs: {
          id: new URL(projectResource.url).hostname,
          name: {
            en: projectResource.owner,
          },
        },
      };
      json.identification.primary = {
        ag: {
          [id]: {
            revision: '1',
            timestamp: moment().format(),
          },
        },
      };
      json.identification.upstream = {
        dcs: [{
          [`${projectResource.owner}:${projectResource.name}`]: {
            revision: projectResource.release.tag_name,
            timestamp: projectResource.released,
          },
        },
        ],
      };
      json.identification.name.en = projectResource.name;
      json.identification.abbreviation.en = '';
      const code = findCode(languageCode, resourceMeta.dublin_core.language.title);
      if (code) {
        json.languages[0].tag = code;
      } else {
        json.languages[0].tag = resourceMeta.dublin_core.language.title.substring(0, 3);
      }
      json.languages[0].name.en = projectResource.language_title;

      json.copyright.shortStatements = [
        {
          statement: resourceMeta?.dublin_core?.rights,
        },
      ];
      json.copyright.licenses[0].ingredient = 'LICENSE.md';
      if (selectResource === 'bible') {
        resourceMeta.books.forEach((scope) => {
          json.type.flavorType.currentScope[scope.toUpperCase()] = [];
          localizedNames[scope.toUpperCase()] = json.localizedNames[scope.toUpperCase()];
        });
        json.localizedNames = localizedNames;
      }

      logger.debug('createDownloadedResourceSB.js', 'Created the createBibleResource SB');
      resolve(json);
    });
  } catch (err) {
    throw new Error(`Generate Burrito Failed :  ${err}`);
  }
};

// export default createDownloadedResourceSB;

export const generateAgSettings = async (metaData, currentResourceMeta, selectResource) => new Promise((resolve) => {
  logger.debug('DownloadResourcePopUp.js', 'In generate ag-settings for resource downloaded');
  try {
    const settings = {
      version: environment.AG_SETTING_VERSION,
      project: {
        [metaData.type.flavorType.flavor.name]: {
          scriptDirection: currentResourceMeta?.dublin_core?.language?.direction,
          starred: false,
          description: currentResourceMeta?.dublin_core?.description,
          copyright: currentResourceMeta?.dublin_core?.rights,
          lastSeen: moment().format(),
          refResources: [],
          bookMarks: [],
        },
      },
      sync: { services: { door43: [] } },
    };
    if (selectResource === 'bible') {
      settings.versification = 'ENG';
    }
    resolve(settings);
  } catch (err) {
    throw new Error(`Generate Ag-settings Failed :  ${err}`);
  }
});

export const generateResourceIngredientsTextTransaltion = async (currentResourceMeta, path, folder, currentResourceProject, resourceBurritoFile) => {
  // generating ingredients content in metadata
  currentResourceMeta?.projects.forEach(async (project) => {
    logger.debug('DownloadResourcePopUp.js', 'In adding ingredients to burrito for TextTransaltion');
    const fs = window.require('fs');
    if (fs.existsSync(path.join(folder, currentResourceProject.name, project.path))) {
      const filecontent = await fs.readFileSync(path.join(folder, currentResourceProject.name, project.path), 'utf8');
      // find checksum & size by read the file
      const checksum = md5(filecontent);
      const stats = fs.statSync(path.join(folder, currentResourceProject.name, project.path));
      resourceBurritoFile.ingredients[project.path] = {
        checksum: { md5: checksum },
        mimeType: currentResourceMeta.dublin_core.format,
        size: stats.size,
        scope: { [project?.identifier.toUpperCase()]: [] },
      };
    } else {
      logger.debug('DownloadResourcePopUp.js', 'error file not found in resource download');
      throw new Error(`File not Exist in project Directory:  ${project.path}`);
    }
  });
  return resourceBurritoFile;
};

export const generateResourceIngredientsOBS = async (currentResourceMeta, path, folder, currentResourceProject, resourceBurritoFile, files) => {
  console.log('DownloadResourcePopUp.js', 'In adding ingredients to burrito of OBS');

  for (const file of files) {
    const endPart = file.split('/').pop();
    const regX = /^\d{2}.md$/;

    if (regX.test(endPart) || ['intro.md', 'title.md'].includes(endPart)) {
      const filePath = `autographa/users/samuel/resources/${file}`;
      const { data: fileResponse, error: fileError } = await supabaseStorage()
        .download(filePath);

      if (fileError) {
        logger.debug('DownloadResourcePopUp.js', 'error file not found in resource download');
        throw new Error(`File not Exist in project Directory: ${file}`);
      }

      const filecontent = await fileResponse.text();
      const checksum = md5(filecontent);
      const stats = { size: fileResponse.size };

      resourceBurritoFile.ingredients[file.replace(`${currentResourceProject.name}/`, '')] = {
        checksum: { md5: checksum },
        mimeType: currentResourceMeta.dublin_core.format,
        size: stats.size,
      };

      if (endPart.toLowerCase() === 'front.md') {
        resourceBurritoFile.ingredients[file.replace(`${currentResourceProject.name}/`, '')].role = 'pubdata';
      } else if (regX.test(endPart)) {
        const matchingStory = OBSData.find((story) => `${story.storyId.toString().padStart(2, 0)}.md` === endPart.toLowerCase());
        if (matchingStory) {
          resourceBurritoFile.ingredients[file.replace(`${currentResourceProject.name}/`, '')].scope = matchingStory.scope;
        }
      } else {
        resourceBurritoFile.ingredients[file.replace(`${currentResourceProject.name}/`, '')].role = 'title';
      }
    }
  }

  return resourceBurritoFile;
};

export const handleDownloadResources = async (resourceData, selectResource, action, update = false) => {
  logger.debug('DownloadResourcePopUp.js', 'In resource download - started : ');
  const newpath = localStorage.getItem('userPath');
  console.log({
    resourceData, selectResource, action, update,
  });
  return new Promise((resolve, reject) => {
    localForage.getItem('userProfile').then(async (user) => {
      logger.debug('DownloadResourcePopUp.js', 'In resource download user fetch - ', user?.username);
      const folder = path.join(newpath, 'autographa', 'users', `${user?.username}`, 'resources');
      const fs = window.require('fs');
      let resourceBurritoFile = {};
      let currentResourceMeta = '';
      let currentResourceProject = '';
      let licenseFileFound = false;
      let currentProjectName = '';
      let customLicenseContent = 'empty';
      let resourceExist = false;
      let resourceExistCount = 0;
      try {
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const key in resourceData) {
          // eslint-disable-next-line no-await-in-loop, no-restricted-syntax, guard-for-in
          for (const row in resourceData[key]) {
            const resource = resourceData[key][row];
            if (resource.isChecked) {
              logger.debug('passed is checked ---------->');
              if (!update) {
                // check for duplicate
                const existingResource = fs.readdirSync(folder, { withFileTypes: true });
                // eslint-disable-next-line no-loop-func
                existingResource.forEach((element) => {
                  let filecontentMeta = fs.readFileSync(path.join(folder, element.name, 'metadata.json'), 'utf8');
                  filecontentMeta = JSON.parse(filecontentMeta);
                  if (filecontentMeta?.resourceMeta) {
                    const storedresourceMeta = filecontentMeta?.resourceMeta;
                    if (storedresourceMeta?.name === resource?.name && storedresourceMeta?.owner === resource?.owner
                      && storedresourceMeta?.release?.tag_name === resource?.release?.tag_name) {
                      logger.debug('DownloadResourcePopUp.js', `In resource download  existing resource ${resource?.name}_${resource?.release?.tag_name}`);
                      resourceExist = true;
                      resourceExistCount += 1;
                    }
                  }
                });
              }
              if (!resourceExist) {
                // eslint-disable-next-line no-await-in-loop
                await fetch(resource.metadata_json_url)
                  .then((res) => res.json())
                  // eslint-disable-next-line no-loop-func
                  .then(async (response) => {
                    logger.debug('passed  fetch meta ---------->', { response });
                    logger.debug('DownloadResourcePopUp.js', 'In resource download - fetch resourceMeta yml');
                    currentResourceMeta = response;
                    currentResourceProject = resource;
                    // creating burrito template
                    resourceBurritoFile = await createDownloadedResourceSB(user?.username, currentResourceMeta, currentResourceProject, selectResource);
                    // adding online fetch response meta as resourceMeta
                    resourceBurritoFile.resourceMeta = currentResourceProject;
                    resourceBurritoFile.resourceMeta.lastUpdatedAg = moment().format();
                    logger.debug('passed  create burrito ---------->');

                    logger.debug('DownloadResourcePopUp.js', 'In resource download - basic burrito generated for resource ', `${resource.name}-${resource.owner}`);

                    currentProjectName = `${resource.name}_${Object.keys(resourceBurritoFile.identification.primary.ag)[0]}`;
                    await fetch(resource.zipball_url)
                      .then((res) => res.arrayBuffer())
                      .then(async (blob) => {
                        logger.debug('DownloadResourcePopUp.js', 'In resource download - downloading zip content ');
                        if (!fs.existsSync(folder)) {
                          fs.mkdirSync(folder, { recursive: true });
                        }
                        // wririntg zip to local
                        await fs.writeFileSync(path.join(folder, `${currentProjectName}.zip`), Buffer.from(blob));
                        logger.debug('DownloadResourcePopUp.js', 'In resource download - downloading zip content completed ');

                        logger.debug('DownloadResourcePopUp.js', 'In resource download - Unzip downloaded resource');
                        // extract zip
                        const filecontent = await fs.readFileSync(path.join(folder, `${currentProjectName}.zip`));
                        const result = await JSZip.loadAsync(filecontent);
                        const keys = Object.keys(result.files);

                        // eslint-disable-next-line no-restricted-syntax
                        for (const key of keys) {
                          const item = result.files[key];
                          if (item.dir) {
                            fs.mkdirSync(path.join(folder, item.name), { recursive: true });
                          } else {
                            // eslint-disable-next-line no-await-in-loop
                            const bufferContent = Buffer.from(await item.async('arraybuffer'));
                            fs.writeFileSync(path.join(folder, item.name), bufferContent);
                          }
                          if (key.toLowerCase().includes('license')) {
                            logger.debug('DownloadResourcePopUp.js', 'In resource download - check license file found');
                            licenseFileFound = true;
                            // console.log('license exist');
                            if (fs.existsSync(path.join(folder, key))) {
                              const licenseContent = fs.readFileSync(path.join(folder, key), 'utf8');
                              const checksum = md5(licenseContent);
                              const stats = fs.statSync(path.join(folder, key));
                              resourceBurritoFile.ingredients[key.replace(currentResourceProject.name, '.')] = {
                                checksum: { md5: checksum },
                                mimeType: 'text/md',
                                size: stats.size,
                                role: 'x-licence',
                              };
                            }
                          }
                        }
                        logger.debug('passed zip extract ---------->');

                        // ingredients add to burrito
                        switch (selectResource) {
                          case 'bible':
                            resourceBurritoFile = await generateResourceIngredientsTextTransaltion(currentResourceMeta, path, folder, currentResourceProject, resourceBurritoFile);
                            customLicenseContent = customLicense;
                            break;
                          case 'obs':
                            resourceBurritoFile = await generateResourceIngredientsOBS(currentResourceMeta, path, folder, currentResourceProject, resourceBurritoFile, keys);
                            customLicenseContent = OBSLicense;
                            break;
                          default:
                            throw new Error(' can not process :Inavalid Type od Resource requested');
                        }
                        logger.debug('passed ingredients creations ---------->');

                        // custom license adding
                        if (!licenseFileFound) {
                          logger.debug('DownloadResourcePopUp.js', 'In resource custom license add - no license found');
                          // console.log('no license file found -', md5(customLicenseContent));
                          if (fs.existsSync(path.join(folder, currentResourceProject.name))) {
                            fs.writeFileSync(path.join(folder, currentResourceProject.name, 'LICENSE.md'), customLicenseContent);
                            const stats = fs.statSync(path.join(folder, currentResourceProject.name, 'LICENSE.md'));
                            resourceBurritoFile.ingredients['./LICENSE.md'] = {
                              checksum: { md5: md5(customLicenseContent) },
                              mimeType: 'text/md',
                              size: stats.size,
                              role: 'x-licence',
                            };
                          }
                        }

                        // ag settings file generation
                        logger.debug('DownloadResourcePopUp.js', 'generating ag-settings');
                        const settings = await generateAgSettings(resourceBurritoFile, currentResourceMeta, selectResource);
                        await fs.writeFileSync(path.join(folder, currentResourceProject.name, 'ag-settings.json'), JSON.stringify(settings));
                        const settingsContent = fs.readFileSync(path.join(folder, currentResourceProject.name, 'ag-settings.json'), 'utf8');
                        const checksum = md5(settingsContent);
                        const stats = fs.statSync(path.join(folder, currentResourceProject.name, 'ag-settings.json'));
                        resourceBurritoFile.ingredients['./ag-settings.json'] = {
                          checksum: { md5: checksum },
                          mimeType: 'application/json',
                          size: stats.size,
                          role: 'x-autographa',
                        };
                        // added new section to avoid ingredients issue in meta some times (new user)
                        const ymlPath = currentResourceMeta?.projects[0]?.path.replace('./', '');
                        const renames = Object.keys(resourceBurritoFile.ingredients);
                        const regex = new RegExp(`(\\.\\/)|(${ymlPath}[\\/\\\\])`, 'g');
                        await renames?.forEach((rename) => {
                          if (!rename.match(regex)) {
                            delete resourceBurritoFile.ingredients[rename];
                          }
                        });
                        // write metaData.json
                        await fs.writeFileSync(path.join(folder, currentResourceProject.name, 'metadata.json'), JSON.stringify(resourceBurritoFile));

                        logger.debug('passed ag settings creations ---------->');

                        // finally remove zip and rename base folder to projectname_id
                        logger.debug('DownloadResourcePopUp.js', 'deleting zip file - rename project with project + id in ag format');
                        if (fs.existsSync(folder)) {
                          fs.renameSync(path.join(folder, currentResourceProject.name), path.join(folder, currentProjectName));
                          fs.unlinkSync(path.join(folder, `${currentProjectName}.zip`), () => {
                            logger.debug('DownloadResourcePopUp.js', 'error in deleting zip');
                            throw new Error(`Removing Resource Zip Failed :  ${currentResourceProject.name}`);
                          });
                        }
                      }).catch((err) => {
                        throw new Error(`Download Resource file Failed :  ${err}`);
                      });
                  }).catch((err) => {
                    throw new Error(`Fetch Resource Failed :  ${err}`);
                  });
              }
              resourceExist = false;
              logger.debug('DownloadResourcePopUp.js', 'Finished single resource: ');
              logger.debug('completed single resource ---------->', resource.name);
              action && action?.setDownloadCount((prev) => prev + 1);
            }
          }
          // console.log('lang group finished ---------------------------');
          if (update && update.status) {
            // eslint-disable-next-line no-await-in-loop
            await fs.rmdir(path.join(folder, update?.oldResource?.projectDir), { recursive: true }, (err) => {
              if (err) {
                throw new Error(`Delete old Resource failed :  ${err}`);
              }
            });
          }
          resolve({ status: 'success', existing: resourceExistCount });
          resourceExistCount = 0;
        }
      } catch (err) {
        logger.debug('DownloadResourcePopUp.js', 'Catching error in dowload resource', err);
        reject(err);
      }
    });
  });
};

export const handleDownloadWebResources = async (resourceData, selectResource, action, update = false) => {
  logger.debug('DownloadResourcePopUp.js', 'In resource download - started : ');
  console.log({
    resourceData,
    selectResource,
    action,
    update,
  });

  return new Promise(async (resolve, reject) => {
    const folder = 'autographa/users/samuel/resources';
    const storage = supabase.storage.from('autographa-web'); // Initialize Supabase storage
    const user = 'samuel';
    let resourceBurritoFile = {};
    let currentResourceMeta = '';
    let currentResourceProject = '';
    let licenseFileFound = false;
    let currentProjectName = '';
    let customLicenseContent = 'empty';
    let resourceExist = false;
    let resourceExistCount = 0;

    try {
      for (const key in resourceData) {
        for (const row in resourceData[key]) {
          const resource = resourceData[key][row];
          if (resource.isChecked) {
            console.log('passed is checked ---------->');
            if (!update) {
              const { data: existingResources } = await supabaseStorage().list(folder);
              console.log({ existingResources });
              for (const element of existingResources) {
                console.log(element.name);
                const { data: filecontentMeta } = await supabaseStorage().download(`${folder}/${element.name}/metadata.json`);
                const storedResourceMeta = filecontentMeta;
                if (storedResourceMeta?.resourceMeta) {
                  const storedResourceName = storedResourceMeta.resourceMeta.name;
                  const storedResourceOwner = storedResourceMeta.resourceMeta.owner;
                  const storedResourceTag = storedResourceMeta.resourceMeta.release?.tag_name;
                  if (
                    storedResourceName === resource.name
                    && storedResourceOwner === resource.owner
                    && storedResourceTag === resource.release?.tag_name
                  ) {
                    console.log(
                      'DownloadResourcePopUp.js',
                      `In resource download existing resource ${resource.name}_${resource.release?.tag_name}`,
                    );
                    resourceExist = true;
                    resourceExistCount += 1;
                  }
                }
              }
            }

            if (!resourceExist) {
              const response = await fetch(resource.metadata_json_url);
              const metadataJson = await response.json();
              console.log('passed fetch meta ---------->', { metadataJson });
              console.log('DownloadResourcePopUp.js', 'In resource download - fetch resourceMeta yml');
              currentResourceMeta = metadataJson;
              currentResourceProject = resource;

              resourceBurritoFile = await createDownloadedResourceSB(user, currentResourceMeta, currentResourceProject, selectResource);
              resourceBurritoFile.resourceMeta = currentResourceProject;
              resourceBurritoFile.resourceMeta.lastUpdatedAg = moment().format();
              console.log('passed create burrito ---------->');

              console.log('DownloadResourcePopUp.js', 'In resource download - basic burrito generated for resource ', `${resource.name}-${resource.owner}`);

              currentProjectName = `${resource.name}_${Object.keys(resourceBurritoFile.identification.primary.ag)[0]}`;

              const zipResponse = await fetch(resource.zipball_url);
              const zipBuffer = await zipResponse.arrayBuffer();
              console.log('DownloadResourcePopUp.js', 'In resource download - downloading zip content completed ');

              console.log('DownloadResourcePopUp.js', 'In resource download - Unzip downloaded resource');
              const jsZip = new JSZip();
              const zip = await jsZip.loadAsync(zipBuffer);

              for (const [zipPath, zipObject] of Object.entries(zip.files)) {
                if (zipObject.dir) {
                  await storage.upload(`${folder}/${zipObject.name}`, { upsert: false });
                } else {
                  const fileContent = await zipObject.async('uint8array');
                  await storage.upload(`${folder}/${zipObject.name}`, fileContent, { upsert: false });
                }
                if (zipPath.toLowerCase().includes('license')) {
                  console.log('DownloadResourcePopUp.js', 'In resource download - check license file found');
                  licenseFileFound = true;
                  const { data: customLicense } = await supabaseStorage().download(`${folder}/${zipPath}`);
                  if (customLicense) {
                    const { data: licenseContent } = await storage.download(`${folder}/${zipPath}`);
                    const checksum = md5(licenseContent);
                    const { data: size } = await storage.download(`${folder}/${zipPath}`);
                    resourceBurritoFile.ingredients[zipPath.replace(currentResourceProject.name, '.')] = {
                      checksum: { md5: checksum },
                      mimeType: 'text/md',
                      size,
                      role: 'x-licence',
                    };
                  }
                }
              }

              console.log('passed zip extract ---------->');

              switch (selectResource) {
                case 'bible':
                  resourceBurritoFile = await generateResourceIngredientsTextTransaltion(
                    currentResourceMeta,
                    storage,
                    folder,
                    currentResourceProject,
                    resourceBurritoFile,
                  );
                  customLicenseContent = customLicense;
                  break;
                case 'obs':
                  resourceBurritoFile = await generateResourceIngredientsOBS(
                    currentResourceMeta,
                    storage,
                    folder,
                    currentResourceProject,
                    resourceBurritoFile,
                    Object.keys(zip.files),
                  );
                  customLicenseContent = OBSLicense;
                  break;
                default:
                  throw new Error('Cannot process: Invalid type of resource requested');
              }

              console.log('passed ingredients creations ---------->');

              if (!licenseFileFound) {
                console.log('DownloadResourcePopUp.js', 'In resource custom license add - no license found');

                const { data } = await supabaseStorage().list(`${folder}/${currentResourceProject.name}`);
               console.log('what is the length', { data });
                if (data.length > 0) {
                  await storage.upload(`${folder}/${currentResourceProject.name}/LICENSE.md`, customLicenseContent, { upsert: false });
                  const { data: size } = await storage.download(`${folder}/${currentResourceProject.name}/LICENSE.md`);
                 if (size) {
                  console.log('In resource custom license add - custom license added', { size });
                   resourceBurritoFile.ingredients['./LICENSE.md'] = {
                     checksum: { md5: md5(customLicenseContent) },
                     mimeType: 'text/md',
                     size,
                     role: 'x-licence',
                   };
                 }
                }
              }

              const settings = await generateAgSettings(resourceBurritoFile, currentResourceMeta, selectResource);
              await storage.upload(`${folder}/${currentResourceProject.name}/ag-settings.json`, JSON.stringify(settings), { upsert: false });
              const { data: size } = await storage.download(`${folder}/${currentResourceProject.name}/ag-settings.json`);
              resourceBurritoFile.ingredients['./ag-settings.json'] = {
                checksum: { md5: md5(JSON.stringify(settings)) },
                mimeType: 'application/json',
                size,
                role: 'x-autographa',
              };

              const ymlPath = currentResourceMeta?.projects[0]?.path.replace('./', '');
              const renames = Object.keys(resourceBurritoFile.ingredients);
              const regex = new RegExp(`(\\.\\/)|(${ymlPath}[\\/\\\\])`, 'g');
              renames?.forEach((rename) => {
                if (!rename.match(regex)) {
                  delete resourceBurritoFile.ingredients[rename];
                }
              });

              await storage.upload(`${folder}/${currentResourceProject.name}/metadata.json`, JSON.stringify(resourceBurritoFile), { upsert: false });
              console.log('passed ag settings creations ---------->');
              const { data, error } = await storage.list(`${folder}/${currentResourceProject.name}`);
              if (data) {
                await storage.update(`${folder}/${currentResourceProject.name}`, `${folder}/${currentProjectName}`, { cacheControl: '3600', upsert: true });
                await storage.remove(`${folder}/${currentProjectName}.zip`);
              } else {
                console.log('error in storage.list ---------->', error);
              }
            }

            resourceExist = false;
            console.log('DownloadResourcePopUp.js', 'Finished single resource: ');
            console.log('completed single resource ---------->', resource.name);
            action && action?.setDownloadCount((prev) => prev + 1);
          }
        }

        if (update && update.status) {
          await storage.remove(`${folder}/${update?.oldResource?.projectDir}`, { recursive: true });
        }

        resolve({ status: 'success', existing: resourceExistCount });
        resourceExistCount = 0;
      }
    } catch (err) {
      console.log('Catching error in download resource', err);
      reject(err);
    }
  });
};
