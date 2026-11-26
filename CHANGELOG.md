# Changelog

Notable changes to the ccmjs Google Login component are documented here, newest first.

## 1.2.0

### Added

- The new `config.font` dependency loads the bundled Google Sans Medium
  stylesheet for the sign-in button.

### Changed

- The sign-in button follows Google's light rectangular design with the official
  Google G and the configured label. The sign-in and sign-out controls now both
  have a minimum height of 44 px.
- The account view uses the ccmjs tile mark when a profile picture is unavailable.
  The demo and hosted popup use the same artwork as their favicon.
- The hosted popup shows the requesting website's origin beneath the localized
  sign-in heading.
- The bundled ccm-ui 1.0.0 library now includes its readable module alongside
  the minified file.

## 1.1.0

### Added

- English and German labels for the component and its popup are available in
  `resources/content.mjs`, alongside the default sign-out icon.

## 1.0.2

### Changed

- Google Login and its demo now use ccmjs 29.1.0. Apps running that version can
  instantiate Google Login directly or as a User provider using its default
  framework dependency.

## 1.0.1

### Fixed

- Updated the release tooling to preserve the scope of nested CSS rules in the
  published stylesheet.

## 1.0.0

### Added

- Initial release with Google popup sign-in and CCM session management, usable
  directly as an app's user instance or as a provider for the User component.
