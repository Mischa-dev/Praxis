// Profile manifest YAML validation

import {
  type ValidationResult,
  type ValidationError,
  requireString,
  optionalString,
  requireArray,
  requireObject,
  optionalEnum,
  optionalBoolean,
  makeResult
} from './validate'

const ENFORCEMENT_MODES = ['warn', 'block', 'off']

export function validateManifest(data: unknown): ValidationResult {
  const errors: ValidationError[] = []
  const root = 'manifest'

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push({ path: root, message: 'Manifest must be an object' })
    return makeResult(errors)
  }

  const obj = data as Record<string, unknown>

  // Required top-level strings
  requireString(obj, 'id', root, errors)
  requireString(obj, 'name', root, errors)
  requireString(obj, 'tagline', root, errors)
  requireString(obj, 'description', root, errors)
  requireString(obj, 'version', root, errors)

  // Branding
  requireObject(obj, 'branding', root, errors)
  if (typeof obj.branding === 'object' && obj.branding !== null) {
    const branding = obj.branding as Record<string, unknown>
    optionalString(branding, 'logo_ascii', `${root}.branding`, errors)
    optionalString(branding, 'tagline_secondary', `${root}.branding`, errors)
  }

  // Themes
  requireArray(obj, 'themes', root, errors)
  if (Array.isArray(obj.themes)) {
    for (let i = 0; i < obj.themes.length; i++) {
      const theme = obj.themes[i]
      const path = `${root}.themes[${i}]`
      if (typeof theme !== 'object' || theme === null) {
        errors.push({ path, message: 'Theme must be an object' })
        continue
      }
      const t = theme as Record<string, unknown>
      requireString(t, 'id', path, errors)
      requireString(t, 'label', path, errors)
      requireString(t, 'accent_primary', path, errors)
      requireString(t, 'accent_secondary', path, errors)
      requireString(t, 'description', path, errors)
      optionalBoolean(t, 'default', path, errors)
      // Extended theme fields (optional)
      optionalString(t, 'accent_dim', path, errors)
      optionalString(t, 'accent_subtle', path, errors)
      optionalString(t, 'accent_text', path, errors)
      optionalString(t, 'button_primary_text', path, errors)
    }
  }

  // Target types
  requireArray(obj, 'target_types', root, errors)
  if (Array.isArray(obj.target_types)) {
    for (let i = 0; i < obj.target_types.length; i++) {
      const tt = obj.target_types[i]
      const path = `${root}.target_types[${i}]`
      if (typeof tt !== 'object' || tt === null) {
        errors.push({ path, message: 'Target type must be an object' })
        continue
      }
      const t = tt as Record<string, unknown>
      requireString(t, 'id', path, errors)
      requireString(t, 'label', path, errors)
      requireString(t, 'icon', path, errors)
      optionalString(t, 'validation', path, errors)
    }
  }

  // Categories
  requireArray(obj, 'categories', root, errors)
  if (Array.isArray(obj.categories)) {
    for (let i = 0; i < obj.categories.length; i++) {
      const cat = obj.categories[i]
      const path = `${root}.categories[${i}]`
      if (typeof cat !== 'object' || cat === null) {
        errors.push({ path, message: 'Category must be an object' })
        continue
      }
      const c = cat as Record<string, unknown>
      requireString(c, 'id', path, errors)
      requireString(c, 'label', path, errors)
      requireString(c, 'icon', path, errors)
      requireString(c, 'description', path, errors)
    }
  }

  // Scope (optional top-level object)
  if ('scope' in obj && obj.scope !== undefined) {
    if (typeof obj.scope !== 'object' || obj.scope === null) {
      errors.push({ path: `${root}.scope`, message: 'Scope must be an object' })
    } else {
      const scope = obj.scope as Record<string, unknown>
      if (typeof scope.enabled !== 'boolean') {
        errors.push({ path: `${root}.scope.enabled`, message: 'scope.enabled must be a boolean' })
      }
      optionalString(scope, 'cloud_providers_dir', `${root}.scope`, errors)
      optionalEnum(scope, 'enforcement_default', ENFORCEMENT_MODES, `${root}.scope`, errors)
    }
  }

  // Paths (optional)
  if ('paths' in obj && obj.paths !== undefined) {
    if (typeof obj.paths !== 'object' || obj.paths === null) {
      errors.push({ path: `${root}.paths`, message: 'Paths must be an object' })
    } else {
      const paths = obj.paths as Record<string, unknown>
      for (const key of ['modules', 'workflows', 'glossary', 'actions', 'scope']) {
        optionalString(paths, key, `${root}.paths`, errors)
      }
    }
  }

  // Views (optional)
  if ('views' in obj && obj.views !== undefined) {
    if (!Array.isArray(obj.views)) {
      errors.push({ path: `${root}.views`, message: 'views must be an array' })
    } else {
      const NAV_SECTIONS = ['primary', 'secondary', 'hidden']
      for (let i = 0; i < obj.views.length; i++) {
        const view = obj.views[i]
        const path = `${root}.views[${i}]`
        if (typeof view !== 'object' || view === null) {
          errors.push({ path, message: 'View must be an object' })
          continue
        }
        const v = view as Record<string, unknown>
        requireString(v, 'id', path, errors)
        requireString(v, 'component', path, errors)
        requireString(v, 'label', path, errors)
        requireString(v, 'icon', path, errors)
        optionalEnum(v, 'nav_section', NAV_SECTIONS, path, errors)
        optionalNumber(v, 'nav_order', path, errors)
      }
    }
  }

  // Layout (optional — all fields optional)
  if ('layout' in obj && obj.layout !== undefined) {
    if (typeof obj.layout !== 'object' || obj.layout === null) {
      errors.push({ path: `${root}.layout`, message: 'layout must be an object' })
    }
    // Structural validation only — individual fields all have sensible defaults
  }

  // Effects (optional — all fields optional)
  if ('effects' in obj && obj.effects !== undefined) {
    if (typeof obj.effects !== 'object' || obj.effects === null) {
      errors.push({ path: `${root}.effects`, message: 'effects must be an object' })
    } else {
      const effects = obj.effects as Record<string, unknown>
      optionalBoolean(effects, 'scanlines', `${root}.effects`, errors)
      optionalBoolean(effects, 'glow', `${root}.effects`, errors)
      optionalBoolean(effects, 'glitch_logo', `${root}.effects`, errors)
      optionalBoolean(effects, 'hover_lift', `${root}.effects`, errors)
    }
  }

  return makeResult(errors)
}
