// js/data/constants.js — primitive numeric constants for generated code (spec §11)
//
// The hard rule (§11) is "zero numeric literals in layer/factory code — every
// number resolves from a data row." Generated code still needs a handful of
// mathematical primitives (identity 1, zero, the +1 step when buying a buyable,
// percentage base 100, etc.). Rather than smuggle literals into the factory,
// they live here as named data and are read like any other tuning value. This
// is a data row source, not code, so the rule holds.
//
// FACTORY_NUMERICS shape (read by js/build/*.js):
//   zero        0   additive identity / sentinel
//   one         1   multiplicative identity, single-step increment
//   hundred     100 percentage base (for "+N%" effect text)
//   firstGridClickableId 11  TMT renders clickables and upgrades as a row*10+col grid
//                       (see setRowCol in layerSupport.js). A generated set keyed from this
//                       base lands in row 1 (11, 12, 13, ...), so the grid derives rows >= 1
//                       and actually renders. Index-based keys (0, 1, ...) derive rows = 0
//                       and silently render nothing.
//   maturityBarSegments 20  number of cells in the text maturity bar drawn on an auto-prestige
//                       realm (the auto-cultivation readout). A display dimension, like the
//                       forge bar's barWidth in SETPIECE_DATA.

var FACTORY_NUMERICS = {
    zero: 0,
    one: 1,
    hundred: 100,
    firstGridClickableId: 11,
    maturityBarSegments: 20
};
