// js/layers.js — intentionally empty.
//
// In this mod the game's layers are NOT hand-authored here. They are generated
// from the plain-JS data tables (js/data/*.js) by the config->layer factory
// (js/build/layerFactory.js, spec §11), which calls addLayer(...) for the Body
// side layer ("b"), the Sect Standing gate ("gate"), and the realm chain
// ("q","f","c") at load time — before this file is injected by the modFiles
// loader.
//
// The stock TMT demo "prestige" layer ("p") that shipped here has been removed:
// it was a placeholder on row 0 that would have collided with the Qi
// Condensation realm and is not part of the cultivation design. Leaving this
// file present (and listed in modInfo.modFiles) keeps the loader happy without
// registering any extra layers.
//
// To add or tune game content, edit the data tables in js/data/, not this file.
