import { TargetTypeEnum } from '../constants/enums';
import * as ERROR_MSGS from '../constants/error.messages';
import * as METADATA_KEY from '../constants/metadata.keys';
import { Target } from '../decorators';
import * as interfaces from '../interfaces';
import { LazyServiceIdentifer } from './core';

function getFunctionName(v: any): string {
  if (v.name) {
    return v.name;
  } else {
    const name = v.toString();
    const match = name.match(/^function\s*([^\s(]+)/);
    return match ? match[1] : `Anonymous function: ${name}`;
  }
}

function getDependencies(
  metadataReader: interfaces.MetadataReader, func: Function
): interfaces.Target[] {
  const constructorName = getFunctionName(func);
  const targets = getTargets(metadataReader, constructorName, func, false);
  return targets;
}

function getTargets(
  metadataReader: interfaces.MetadataReader,
  constructorName: string,
  func: Function,
  isBaseClass: boolean
): interfaces.Target[] {

  const metadata = metadataReader.getConstructorMetadata(func);

  // TypeScript compiler generated annotations
  const serviceIdentifiers = metadata.compilerGeneratedMetadata;

  // All types resolved must be annotated with @injectable
  if (serviceIdentifiers === undefined) {
    const msg = `${ERROR_MSGS.MISSING_INJECTABLE_ANNOTATION} ${constructorName}.`;
    throw new Error(msg);
  }

  // User generated annotations
  const constructorArgsMetadata = metadata.userGeneratedMetadata;

  const keys = Object.keys(constructorArgsMetadata);
  const hasUserDeclaredUnknownInjections = (func.length === 0 && keys.length > 0);
  const iterations = (hasUserDeclaredUnknownInjections) ? keys.length : func.length;

  // Target instances that represent constructor arguments to be injected
  const constructorTargets = getConstructorArgsAsTargets(
    isBaseClass,
    constructorName,
    serviceIdentifiers,
    constructorArgsMetadata,
    iterations
  );

  // Target instances that represent properties to be injected
  const propertyTargets = getClassPropsAsTargets(metadataReader, func);

  const targets = [
    ...constructorTargets,
    ...propertyTargets
  ];

  return targets;

}

function getConstructorArgsAsTarget(
  index: number,
  isBaseClass: boolean,
  constructorName: string,
  serviceIdentifiers: any,
  constructorArgsMetadata: any
) {
  // Create map from array of metadata for faster access to metadata
  const targetMetadata = constructorArgsMetadata[index.toString()] || [];
  const metadata = formatTargetMetadata(targetMetadata);
  const isManaged = metadata.unmanaged !== true;

  // Take types to be injected from user-generated metadata
  // if not available use compiler-generated metadata
  let serviceIdentifier = serviceIdentifiers[index];
  const injectIdentifier = (metadata.inject || metadata.multiInject);
  serviceIdentifier = (injectIdentifier) ? (injectIdentifier) : serviceIdentifier;

  // we unwrap LazyServiceIdentifer wrappers to allow circular dependencies on symbols
  if (serviceIdentifier instanceof LazyServiceIdentifer) {
    serviceIdentifier = serviceIdentifier.unwrap();
  }

  // Types Object and Function are too ambiguous to be resolved
  // user needs to generate metadata manually for those
  if (isManaged) {

    const isObject = serviceIdentifier === Object;
    const isFunction = serviceIdentifier === Function;
    const isUndefined = serviceIdentifier === undefined;
    const isUnknownType = (isObject || isFunction || isUndefined);

    if (!isBaseClass && isUnknownType) {
      const msg = `${ERROR_MSGS.MISSING_INJECT_ANNOTATION} argument ${index} in class ${constructorName}.`;
      throw new Error(msg);
    }

    const target = new Target(TargetTypeEnum.ConstructorArgument, metadata.targetName, serviceIdentifier);
    target.metadata = targetMetadata;
    return target;
  }

  return null;

}

function getConstructorArgsAsTargets(
  isBaseClass: boolean,
  constructorName: string,
  serviceIdentifiers: any,
  constructorArgsMetadata: any,
  iterations: number
) {

  const targets: interfaces.Target[] = [];
  for (let i = 0; i < iterations; i++) {
    const index = i;
    const target = getConstructorArgsAsTarget(
      index,
      isBaseClass,
      constructorName,
      serviceIdentifiers,
      constructorArgsMetadata
    );
    if (target !== null) {
      targets.push(target);
    }
  }

  return targets;
}

function getClassPropsAsTargets(metadataReader: interfaces.MetadataReader, constructorFunc: Function) {

  const classPropsMetadata = metadataReader.getPropertiesMetadata(constructorFunc);
  let targets: interfaces.Target[] = [];
  const keys = Object.keys(classPropsMetadata);

  for (const key of keys) {

    // the metadata for the property being injected
    const targetMetadata = classPropsMetadata[key];

    // the metadata formatted for easier access
    const metadata = formatTargetMetadata(classPropsMetadata[key]);

    // the name of the property being injected
    const targetName = metadata.targetName || key;

    // Take types to be injected from user-generated metadata
    const serviceIdentifier = (metadata.inject || metadata.multiInject);

    // The property target
    const target = new Target(TargetTypeEnum.ClassProperty, targetName, serviceIdentifier);
    target.metadata = targetMetadata;
    targets.push(target);
  }

  // Check if base class has injected properties
  const baseConstructor = Object.getPrototypeOf(constructorFunc.prototype).constructor;

  if (baseConstructor !== Object) {

    const baseTargets = getClassPropsAsTargets(metadataReader, baseConstructor);

    targets = [
      ...targets,
      ...baseTargets
    ];

  }

  return targets;
}

function formatTargetMetadata(targetMetadata: interfaces.Metadata[]) {

  // Create map from array of metadata for faster access to metadata
  const targetMetadataMap: any = {};
  targetMetadata.forEach((m: interfaces.Metadata) => {
    targetMetadataMap[m.key.toString()] = m.value;
  });

  // user generated metadata
  return {
    inject: targetMetadataMap[METADATA_KEY.INJECT_TAG],
    multiInject: targetMetadataMap[METADATA_KEY.MULTI_INJECT_TAG],
    targetName: targetMetadataMap[METADATA_KEY.NAME_TAG],
    unmanaged: targetMetadataMap[METADATA_KEY.UNMANAGED_TAG]
  };

}

export {
  getDependencies,
  getFunctionName,
};
