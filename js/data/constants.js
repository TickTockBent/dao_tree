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

var FACTORY_NUMERICS = {
    zero: 0,
    one: 1,
    hundred: 100
};
