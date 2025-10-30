import * as ParticlesToFields from './serializers/ParticlesToFields.js';
import * as FieldsToParticles from './serializers/FieldsToParticles.js';
import * as FieldsToPlates from './serializers/FieldsToPlates.js';
import * as PlatesToFields from './serializers/PlatesToFields.js';
import * as Helpers from './serializers/SerializerHelpers.js';

export const StateSerializer = {
  // Particles <-> Fields
  particlesToFields: ParticlesToFields.particlesToFields,
  fieldsToParticles: FieldsToParticles.fieldsToParticles,

  // Fields <-> Plates
  fieldsToPlates: FieldsToPlates.fieldsToPlates,
  platesToFields: PlatesToFields.platesToFields,

  // Utility helpers
  simplifyFields: Helpers.simplifyFields,
  upsampleFields: Helpers.upsampleFields,
  estimateConversionLoss: Helpers.estimateConversionLoss
};