/* Compatibility entry for the non-cube map regression suite.
 * Face grouping replaces spherical-projection density as the visual contract.
 * These checks cover physical face membership, uniform spacing, move endpoints,
 * solid colors, and the shipped rotation-dial handlers.
 */
require('./face-grouped-rings.test.cjs');
require('./face-map-inline.test.cjs');
