var layoutInfo = {
    startTab: "q",
    startNavTab: "tree-tab",
    showTree: true,

    cultivationTreeLayout: [
        ["q"],
        ["f"],
        ["c"],
        ["j", "g"],
        ["n"],
        ["al", "ar", "re"],
        ["dom"],
        ["sf"],
        ["st"],
        ["asc"],
    ],
    stepTwoTreeLayout: [
        ["yin"],
        ["yang"],
        ["ns"],
        ["nc"],
        ["dsn", "cel", "isl"],
        ["nsh"],
    ],
    stepThreeTreeLayout: [
        ["ess", "jfl"],
        ["nv"],
    ],
}

addLayer("tree-tab", {
    tabFormat: [
        ["tree", function() { return layoutInfo.cultivationTreeLayout }],
    ],
    previousTab: "",
    leftTab: true,
})

addLayer("tree-tab-2", {
    tabFormat: [
        ["tree", function() { return layoutInfo.stepTwoTreeLayout }],
    ],
    layerShown() { return player && player.stepTwoUnlocked },
    previousTab: "",
    leftTab: true,
})

addLayer("tree-tab-3", {
    tabFormat: [
        ["tree", function() { return layoutInfo.stepThreeTreeLayout }],
    ],
    layerShown() { return player && player.stepThreeUnlocked },
    previousTab: "",
    leftTab: true,
})
