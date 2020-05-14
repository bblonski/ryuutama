import {
    RYUU
} from "../config.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class RyuutamaActorSheet extends ActorSheet {

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["ryuutama", "sheet", "actor", "character"],
            width: 600,
            height: 650,
            tabs: [{
                navSelector: ".sheet-tabs",
                contentSelector: ".sheet-body",
                initial: "spells"
            }]
        });
    }

    /* -------------------------------------------- */

    /** @override */
    get template() {
        const path = "systems/ryuutama/templates/actor/";
        return `${path}/${this.actor.data.type}.html`;
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        const data = super.getData();
        /*
        data.dtypes = ["String", "Number", "Boolean"];
        for (let attr of Object.values(data.data.attributes)) {
            attr.isCheckbox = attr.dtype === "Boolean";
        }
        */

        // Prepare items.
        if (this.actor.data.type === "character") {
            this._prepareCharacterItems(data);
        }

        return data;
    }

    /* -------------------------------------------- */

    /** @override */
    async _onDrop(event) {
        event.preventDefault();

        // Get dropped data
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData("text/plain"));
        } catch (err) {
            return false;
        }

        // Handle dropping to another sheet
        if (data) {
            if (this.actor.owner && data.actorId !== undefined && data.actorId === this.actor.id && data.data !== undefined) {

                if (event.toElement.parentNode.dataset.itemId !== undefined) {
                    const actor = game.actors.get(data.actorId);
                    let container = actor.items.find(i => i.data._id === event.toElement.parentNode.dataset.itemId);
                    if (event.toElement.parentNode.dataset.parentId !== undefined) {
                        container = actor.items.find(i => i.data._id === event.toElement.parentNode.dataset.parentId);
                    }
                    const item = actor.items.find(i => i.data._id === data.data._id);
                    if (container !== undefined && container.data.data.canHold !== undefined && container.data.data.holdingSize !== undefined) {
                        if (!item || item.data.data.container === container.id) return;
                        if (!RYUU.NO_STORE.includes(item.type) && RYUU.STORAGE.includes(container.type) && item.data._id !== container.id) {

                            // Check if container is inside a container
                            if (container.data.data.container !== undefined && container.data.data.container !== "") return;

                            // Check if container being dropped has any items in it
                            if (item.data.type === "container") {
                                const droppedHolding = actor.items.filter(i => i.data.data.container === item.data._id);

                                // If the container does have items in it, dump items in and delete container.
                                if (droppedHolding.length > 0) {
                                    let availableSpace = container.data.data.canHold - container.data.data.holdingSize;
                                    let holding = container.data.data.holding;
                                    holding = holding.slice();
                                    let updates = [];
                                    droppedHolding.forEach(i => {
                                        if (i.data.data.size <= availableSpace) {
                                            updates.push({
                                                _id: i._id,
                                                "data.container": container.id
                                            });
                                            holding.push({
                                                id: i._id,
                                                name: i.name,
                                                equippable: RYUU.EQUIPPABLE.includes(i.data.type),
                                                equip: i.data.data.equip,
                                                img: i.img,
                                                size: i.data.data.size
                                            });
                                            availableSpace -= i.data.data.size;
                                        } else {
                                            updates.push({
                                                _id: i._id,
                                                "data.container": ""
                                            });
                                        }
                                    });

                                    container.update({
                                        "data.holding": holding
                                    });

                                    await actor.updateEmbeddedEntity("OwnedItem", updates);
                                    await actor.deleteEmbeddedEntity("OwnedItem", item.data._id);
                                    return;
                                }
                            }

                            let updates = [];

                            // If item already resides in a container, remove it from the original
                            if (item.data.data.container !== undefined && item.data.data.container !== "") {
                                const originalContainer = actor.items.find(i => i.id === item.data.data.container);
                                if (originalContainer !== undefined) {
                                    let originalHolding = originalContainer.data.data.holding;
                                    originalHolding = originalHolding.filter(i => i.id !== item.id);

                                    updates.push({
                                        _id: originalContainer.data._id,
                                        "data.holding": originalHolding
                                    });
                                }
                            }

                            // Get all items already in container and make sure we don't dupe
                            let holding = container.data.data.holding;
                            holding = holding.slice();
                            const found = holding.find(i => i.id === item._id);
                            if (found !== undefined || container.data.data.holdingSize + item.data.data.size > container.data.data.canHold) return;

                            // Add items to container or animal
                            updates.push({
                                _id: item._id,
                                "data.container": container.id,
                                "data.equipped": false
                            });

                            // Push the item to the container
                            holding.push({
                                id: item._id,
                                name: item.name,
                                equippable: RYUU.EQUIPPABLE.includes(item.data.type),
                                equip: item.data.data.equip,
                                img: item.img,
                                size: item.data.data.size
                            });
                            updates.push({
                                _id: container.id,
                                "data.holding": holding
                            });

                            await actor.updateEmbeddedEntity("OwnedItem", updates);
                        }
                    } else {
                        // Remove item from container if it's dropped somewhere else outside the container
                        const actor = game.actors.get(data.actorId);
                        const item = actor.items.find(i => i.data._id === data.data._id);
                        if (!item) return;
                        const container = actor.items.find(i => i.data._id === item.data.data.container);
                        if (!container) return;
                        let holding = container.data.data.holding || [];
                        holding = holding.filter(i => i.id !== item.data._id);
                        let updates = [{
                                _id: container.data._id,
                                "data.holding": holding
                            },
                            {
                                _id: item.data._id,
                                "data.container": ""
                            }
                        ];

                        await actor.updateEmbeddedEntity("OwnedItem", updates);
                    }
                } else {
                    // Remove item from container if it's dropped somewhere else outside the container
                    const actor = game.actors.get(data.actorId);
                    const item = actor.items.find(i => i.data._id === data.data._id);
                    if (!item) return;
                    const container = actor.items.find(i => i.data._id === item.data.data.container);
                    if (!container) return;
                    let holding = container.data.data.holding || [];
                    holding = holding.filter(i => i.id !== item.data._id);
                    let updates = [{
                            _id: container.data._id,
                            "data.holding": holding
                        },
                        {
                            _id: item.data._id,
                            "data.container": ""
                        }
                    ];

                    await actor.updateEmbeddedEntity("OwnedItem", updates);
                }
            }

            // Call parent on drop logic
            return super._onDrop(event);
        }
    }

    /* -------------------------------------------- */

    /**
     * Organize and classify Items for Character sheets.
     *
     * @param {Object} actorData The actor to prepare.
     *
     * @return {undefined}
     */
    _prepareCharacterItems(sheetData) {
        const actorData = sheetData.actor;

        // Initialize containers.
        const gear = [];
        const equipment = [];
        const containers = [];
        const animals = [];
        const classes = [];
        const features = [];
        const spells = {
            "low": [],
            "mid": [],
            "high": []
        };

        // Iterate through items, allocating to containers
        // let totalWeight = 0;
        for (let i of sheetData.items) {
            let item = i.data;
            i.img = i.img || DEFAULT_TOKEN;
            // Append to gear.
            if (i.type === "item" && (item.container === undefined || item.container === "")) {
                gear.push(i);
            }
            // Append to equipment.
            if ((i.type === "weapon" || i.type === "armor" || i.type === "shield" || i.type === "traveling") && (item.container === undefined || item.container === "")) {
                equipment.push(i);
            }
            // Append to container.
            if (i.type === "container" && (item.container === undefined || item.container === "")) {
                containers.push(i);
            }
            // Append to container.
            if (i.type === "animal") {
                animals.push(i);
            }
            // Append to container.
            if (i.type === "class") {
                classes.push(i);
            }
            // Append to features.
            else if (i.type === "feature") {
                features.push(i);
            }
            // Append to spells.
            else if (i.type === "spell") {
                if (item.level != undefined) {
                    spells[item.level].push(i);
                }
            }
        }

        // Assign and return
        actorData.gear = gear;
        actorData.equipment = equipment;
        actorData.containers = containers;
        actorData.animals = animals;
        actorData.classes = classes;
        actorData.features = features;
        actorData.spells = spells;
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Add Inventory Item
        html.find(".item-create").click(this._onItemCreate.bind(this));

        // Update Inventory Item
        html.find(".item-edit").click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            const item = this.actor.getOwnedItem(li.data("itemId"));
            item.sheet.render(true);
        });

        // Delete Inventory Item
        html.find(".item-delete").click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            const liId = li.data("itemId");
            let updates = [];

            // Get item id and container id from actor before deleting
            const item = this.actor.items.find(i => i.data._id === liId);
            const containerId = item.data.data.container;
            if (containerId !== undefined && containerId !== "") {
                // Find the container and filter the items it holds
                const container = this.actor.items.find(i => i.data._id === containerId);
                if (container !== undefined) {
                    let holding = container.data.data.holding.slice();
                    holding = holding.filter(i => i.id !== liId);

                    // Container update
                    updates.push({
                        _id: container.data._id,
                        "data.holding": holding
                    });
                }
            }

            // If item is a container, remove container reference from all items it contains
            let holding = item.data.data.holding;
            if (holding !== undefined) {
                holding.forEach(stored => {
                    updates.push({
                        _id: stored.id,
                        "data.container": ""
                    });
                });
            }

            // Update/Delete Items
            this.actor.updateEmbeddedEntity("OwnedItem", updates);
            this.actor.deleteEmbeddedEntity("OwnedItem", liId);
            li.slideUp(200, () => this.render(false));
        });

        // Remove from container
        html.find(".item-store").click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            const liId = li.data("itemId");

            // Get item id and container id from actor
            const item = this.actor.items.find(i => i.data._id === liId);
            const containerId = item.data.data.container;
            if (containerId !== undefined && containerId !== "") {
                // Find the container and filter the items it holds
                const container = this.actor.items.find(i => i.data._id === containerId);
                if (container !== undefined) {
                    let holding = container.data.data.holding.slice();
                    holding = holding.filter(i => i.id !== liId);

                    const updates = [{
                            _id: container.data._id,
                            "data.holding": holding
                        },
                        {
                            _id: item.data._id,
                            "data.container": ""
                        }
                    ];
                    this.actor.updateEmbeddedEntity("OwnedItem", updates);
                }
            }
        });

        // Check Buttons
        html.find(".rollable").click(this._onRollItem.bind(this));

        // Item State Toggling
        html.find(".item-toggle").click(this._onToggleItem.bind(this));

        if (this.actor.owner) {
            let handler = ev => this._onDragItemStart(ev);
            html.find("li.item").each((i, li) => {
                if (li.classList.contains("inventory-header")) return;
                li.setAttribute("draggable", true);
                li.addEventListener("dragstart", handler, false);
            });
        }

    }

    /* -------------------------------------------- */

    /**
     * Handle toggling the state of an Owned Item within the Actor
     * @param {Event} event   The triggering click event
     * @private
     */
    _onToggleItem(event) {
        event.preventDefault();
        const itemId = event.currentTarget.closest(".item").dataset.itemId;
        const item = this.actor.getOwnedItem(itemId);
        const attr = item.data.type === "spell" ? "data.preparation.prepared" : "data.equipped";
        if (item.data.type === "armor" || item.data.type === "shield" || item.data.type === "weapon" || item.data.type === "traveling") {
            const capacity = this.actor.data.data.attributes.capacity;
            const equippedItems = this.actor.items.filter(i => i.data.data.equipped === true);
            const hand1 = equippedItems.filter(i => i.data.data.equip === "1hand").length;
            const hand2 = equippedItems.filter(i => i.data.data.equip === "2hand").length;
            const feet = equippedItems.filter(i => i.data.data.equip === "feet").length;
            const chest = equippedItems.filter(i => i.data.data.equip === "chest").length;
            const head = equippedItems.filter(i => i.data.data.equip === "head").length;
            const face = equippedItems.filter(i => i.data.data.equip === "face").length;
            const back = equippedItems.filter(i => i.data.data.equip === "back").length;
            const staff = equippedItems.filter(i => i.data.data.equip === "staff").length;
            const accessory = equippedItems.filter(i => i.data.data.equip === "accessory").length;
            const traveling = equippedItems.filter(i => i.data.type === "traveling").length;
            const hands = hand2 > 0 ? 2 : hand1;
            const itemHands = item.data.data.equip === "2hand" ? 2 : 1;

            if (!getProperty(item.data, attr) && (Number(capacity.equipped) + Number(item.data.data.size) > capacity.max)) {
                ui.notifications.error(game.i18n.localize("RYUU.toomuch"));
            } else if (!getProperty(item.data, attr) && ((item.data.data.equip === "1hand" || item.data.data.equip === "2hand") && hands + itemHands > RYUU.MAX_HAND)) {
                ui.notifications.error(game.i18n.localize("RYUU.toomuchhands"));
            } else if (!getProperty(item.data, attr) && (item.data.data.equip === "feet" && feet >= RYUU.MAX_FEET)) {
                ui.notifications.error(game.i18n.localize("RYUU.toomuchfeet"));
            } else if (!getProperty(item.data, attr) && (item.data.data.equip === "chest" && chest >= RYUU.MAX_CHEST)) {
                ui.notifications.error(game.i18n.localize("RYUU.toomuchchest"));
            } else if (!getProperty(item.data, attr) && (item.data.data.equip === "head" && head >= RYUU.MAX_HEAD)) {
                ui.notifications.error(game.i18n.localize("RYUU.toomuchhead"));
            } else if (!getProperty(item.data, attr) && (item.data.data.equip === "face" && face >= RYUU.MAX_FACE)) {
                ui.notifications.error(game.i18n.localize("RYUU.toomuchface"));
            } else if (!getProperty(item.data, attr) && (item.data.data.equip === "back" && back >= RYUU.MAX_BACK)) {
                ui.notifications.error(game.i18n.localize("RYUU.toomuchback"));
            } else if (!getProperty(item.data, attr) && (item.data.data.equip === "staff" && staff >= RYUU.MAX_STAFF)) {
                ui.notifications.error(game.i18n.localize("RYUU.toomuchstaff"));
            } else if (!getProperty(item.data, attr) && (item.data.data.equip === "accessory" && accessory >= RYUU.MAX_ACCESSORY)) {
                ui.notifications.error(game.i18n.localize("RYUU.toomuchaccessory"));
            } else if (!getProperty(item.data, attr) && (item.data.type === "traveling" && traveling >= RYUU.MAX_TRAVEL)) {
                ui.notifications.error(game.i18n.localize("RYUU.toomuchtravel"));
            } else {
                return item.update({
                    [attr]: !getProperty(item.data, attr)
                });
            }
        } else {
            return item.update({
                [attr]: !getProperty(item.data, attr)
            });
        }
    }

    /**
     * Handle rolling things on the Character Sheet
     * @param {Event} event   The triggering click event
     * @private
     */
    _onRollItem(event) {
        const actor = this.actor;
        const attr = actor.data.data.attributes;
        const str = Number(attr.str.value);
        const dex = Number(attr.dex.value);
        const int = Number(attr.int.value);
        const spi = Number(attr.spi.value);
        let journeyDC = 0;
        let terrainBonus = 0;
        let weatherBonus = 0;
        let journeyBonus = 0;
        let currentModifiers = "";

        // To hold all the modifiers a character has + and -
        let modifiers = [];

        const li = $(event.currentTarget).parents(".item");
        const items = this.actor.items;
        const item = items.find(i => i.id === li.data("itemId"));

        // Get all items with the cursed enchantment. Any equipped cursed items give a condition penalty
        const cursedItems = items.filter(i => i.data.data.enchantments.find(e => e.data.conditionPenalty !== 0) !== undefined && i.data.data.equipped);
        let conditionPenalty = 0;
        cursedItems.forEach(cursed => {
            cursed.data.data.enchantments.forEach(enchantment => {
                conditionPenalty += enchantment.data.conditionPenalty;
            });
        });

        // Get all armors the actor is wearing and calculate armor penalty
        const armors = items.filter(i => i.data.data.isArmor === true && i.data.data.equipped === true && Object.prototype.hasOwnProperty.call(i.data.data, "penalty") && i.data.data.penalty !== 0);
        let armorPenalty = 0;
        armors.forEach(armor => {
            armorPenalty -= armor.data.data.penalty;
        });

        // Calculate capacity overrage if any and calculate weight penalty
        if (this.actor.data.type === "character") {
            const maxCapacity = attr.capacity.max;
            const currentCarried = attr.capacity.value;
            let weightPenalty = currentCarried > maxCapacity ? maxCapacity - currentCarried : 0;
            if (weightPenalty !== 0) {
                modifiers.push(weightPenalty);
            }

            // Calculate the current Journey DC and any bonuses to the current terrain/weather
            journeyDC = RYUU.TERRAIN[actor.data.data.current.terrain] + RYUU.WEATHER[actor.data.data.current.weather];
            terrainBonus = actor.data.data.traveling[actor.data.data.current.terrain];
            weatherBonus = actor.data.data.traveling[actor.data.data.current.weather];

            if (actor.data.data.specialty[actor.data.data.current.terrain]) {
                journeyBonus += 2;
            }
            if (actor.data.data.specialty[actor.data.data.current.weather]) {
                journeyBonus += 2;
            }

            // Search for any bonuses to condition and journey checks from class features
            const classes = items.filter(i => i.type === "class");
            classes.forEach(c => {
                c.data.data.features.forEach(feature => {
                    conditionPenalty += feature.data.condition;
                    journeyBonus += feature.data.journey;
                });
            });

            // create a message that outputs all the modifiers on the actors rolls

            if (modifiers.length > 0) {
                currentModifiers = `<br />${actor.name} ${game.i18n.localize("RYUU.checkmodifiers")}:`;
                modifiers.forEach(element => {
                    currentModifiers += ` ${element},`;
                });
                currentModifiers = currentModifiers.replace(/,\s*$/, "");
            }
        }
        switch (event.target.id) {

            // Journey checks
            case "roll-travel": {
                if (journeyBonus > 0) {
                    modifiers.push(journeyBonus);
                }
                if (terrainBonus > 0) {
                    modifiers.push(terrainBonus);
                }
                if (weatherBonus > 0) {
                    modifiers.push(weatherBonus);
                }
                if (armorPenalty !== 0) {
                    modifiers.push(armorPenalty);
                }
                const travelCheck = rollCheck(`1d${str} + 1d${dex}`, `${actor.name} ${game.i18n.localize("RYUU.checktravel")} [STR + DEX]`, modifiers, journeyDC);
                if (travelCheck.crit) {
                    const pcCondition = actor.data.data.attributes.condition.value || 0;
                    actor.update({
                        "data.attributes.condition.value": pcCondition + 1
                    });
                } else if (travelCheck.fumble) {
                    const pcHP = actor.data.data.hp.value || 0;
                    actor.update({
                        "data.hp.value": Math.floor(pcHP / 4)
                    });
                }
                break;
            }

            case "roll-direction": {
                if (journeyBonus > 0) {
                    modifiers.push(journeyBonus);
                }
                if (terrainBonus > 0) {
                    modifiers.push(terrainBonus);
                }
                if (weatherBonus > 0) {
                    modifiers.push(weatherBonus);
                }
                if (armorPenalty !== 0) {
                    modifiers.push(armorPenalty);
                }
                rollCheck(`1d${int} + 1d${int}`, `${actor.name} ${game.i18n.localize("RYUU.checkdirection")} [INT + INT]`, modifiers, journeyDC);
                break;
            }

            case "roll-camp": {
                if (journeyBonus > 0) {
                    modifiers.push(journeyBonus);
                }
                if (terrainBonus > 0) {
                    modifiers.push(terrainBonus);
                }
                if (weatherBonus > 0) {
                    modifiers.push(weatherBonus);
                }
                if (armorPenalty !== 0) {
                    modifiers.push(armorPenalty);
                }
                rollCheck(`1d${dex} + 1d${int}`, `${actor.name} ${game.i18n.localize("RYUU.checkcamp")} [DEX + INT]`, modifiers, journeyDC);
                break;
            }

            // Condition Check
            case "roll-condition": {
                if (conditionPenalty !== 0) {
                    modifiers.push(conditionPenalty);
                }
                if (armorPenalty !== 0) {
                    modifiers.push(armorPenalty);
                }
                const condition = rollCheck(`1d${str} + 1d${spi}`, `${actor.name} ${game.i18n.localize("RYUU.checkcondition")} [STR + SPI]`, modifiers);
                const effects = actor.data.data.effects;
                for (const name in effects) {
                    if (Object.prototype.hasOwnProperty.call(effects, name) && condition.roll >= effects[name]) {
                        let attr = `data.data.effects.${name}`;
                        actor.update({
                            [attr]: 0
                        });
                    }
                }
                actor.update({
                    "data.attributes.condition.value": condition.roll
                });
                break;
            }

            // Initative roll
            case "roll-initiative": {
                if (armorPenalty !== 0) {
                    modifiers.push(armorPenalty);
                }
                const initiative = rollCheck(`1d${dex} + 1d${int}`, `${actor.name} ${game.i18n.localize("RYUU.checkinitiative")} [DEX + INT]`, modifiers);
                actor.update({
                    "data.attributes.initiative": initiative.roll
                });
                break;
            }

            // Single Stat rolls
            case "roll-strength": {
                rollCheck(`1d${str}`, `${actor.name} ${game.i18n.localize("RYUU.checkstr")} [STR]${currentModifiers}`);
                break;
            }

            case "roll-dexterity": {
                rollCheck(`1d${dex}`, `${actor.name} ${game.i18n.localize("RYUU.checkdex")} [DEX]${currentModifiers}`);
                break;
            }

            case "roll-intelligence": {
                rollCheck(`1d${int}`, `${actor.name} ${game.i18n.localize("RYUU.checkint")} [INT]${currentModifiers}`);
                break;
            }

            case "roll-spirit": {
                rollCheck(`1d${spi}`, `${actor.name} ${game.i18n.localize("RYUU.checkspi")} [SPI]${currentModifiers}`);
                break;
            }

            case "set-max-hp": {
                // Set HP to full
                actor.update({
                    "data.hp.value": actor.data.data.hp.max
                });
                break;
            }

            case "set-max-mp": {
                // Set MP to full
                actor.update({
                    "data.mp.value": actor.data.data.mp.max
                });
                break;
            }

            case "use-fumble": {
                // Remvoe a fumble point
                const pcFumble = actor.data.data.attributes.fumble || 0;
                if (pcFumble > 0) {
                    actor.update({
                        "data.attributes.fumble": pcFumble - 1
                    });
                    ChatMessage.create({
                        content: `${actor.name} uses a <strong>fumble point</strong>`
                    }, {});
                }
                break;
            }

            case "roll-accuracy": {
                rollCheck(actor.data.data.accuracy, `${actor.name} attacks!`);
                break;
            }

            case "roll-damage": {
                rollCheck(actor.data.data.damage, `${actor.name} damage:`);
                break;
            }

            case "roll-ability-accuracy": {
                let abilityText = `${actor.name} uses their <strong>Special Ability</strong>:<p>${actor.data.data.ability.description}</p>`;
                if (actor.data.data.ability.accuracy) {
                    rollCheck(actor.data.data.ability.accuracy, abilityText);
                } else {
                    ChatMessage.create({
                        content: abilityText
                    }, {});
                }
                break;
            }

            case "roll-ability-damage": {
                rollCheck(actor.data.data.ability.damage, `${actor.name}'s <strong>Special Ability</strong> damage:`);
                break;
            }

            default:
                // Handle all other roll types
                if (item) {
                    switch (item.data.type) {
                        case "weapon": {
                            let accuracy = item.data.data.accuracy.replace(/(\[|)STR(\]|)/g, "1d@str").replace(/(\[|)DEX(\]|)/g, "1d@dex").replace(/(\[|)INT(\]|)/g, "1d@int").replace(/(\[|)SPI(\]|)/g, "1d@spi");
                            let damage = item.data.data.damage.replace(/(\[|)STR(\]|)/g, "1d@str").replace(/(\[|)DEX(\]|)/g, "1d@dex").replace(/(\[|)INT(\]|)/g, "1d@int").replace(/(\[|)SPI(\]|)/g, "1d@spi");
                            let accuracyRoll;
                            if (event.currentTarget.classList.contains("accuracy")) {
                                if ((!event.altKey && !event.shiftKey) || (!event.altKey && event.shiftKey)) {
                                    accuracyRoll = rollCheck(`${accuracy} + ${item.data.data.masteredBonus}`, `${actor.name} attacks with their <strong>${item.name}</strong>${currentModifiers}`, modifiers);
                                }
                            }
                            if (event.currentTarget.classList.contains("damage")) {
                                if ((event.altKey && event.shiftKey) || (!event.altKey && !event.shiftKey && accuracyRoll !== undefined && accuracyRoll.crit)) {
                                    damage = damage += ` + ${damage}`;
                                    rollCheck(`${damage} + ${item.data.data.damageBonus}`, `<strong>${item.name}</strong> CRITICAL damage:`);
                                } else if ((event.altKey && !event.shiftKey) || (!event.altKey && !event.shiftKey && !(accuracyRoll !== undefined && accuracyRoll.fumble))) {
                                    rollCheck(`${damage} + ${item.data.data.damageBonus}`, `<strong>${item.name}</strong> damage:`);
                                }
                            }
                            break;
                        }

                        case "spell": {
                            const mpRemaining = this.actor.data.data.mp.value;
                            const cost = item.data.data.cost;
                            if (cost > mpRemaining) {
                                ui.notifications.error(`${this.name} does not have enough MP remaining!`);
                            } else {
                                this.actor.update({
                                    "data.mp.value": mpRemaining - cost
                                });
                                rollCheck("1d@int + 1d@spi", `${actor.name} casts <strong>${item.name}</strong> [INT + SPI]<br />${item.data.data.description || ""}<strong>Duration</strong>: ${item.data.data.duration}<br /><strong>Target</strong>: ${item.data.data.target}<br /><strong>Range</strong>: ${item.data.data.range}${currentModifiers}`, modifiers);
                            }
                            console.log(item);
                            break;
                        }

                        default:
                            break;
                    }
                } else {
                    let text = "";
                    if (event.target.previousSibling.previousSibling.innerText) {
                        text = `${actor.name} ${game.i18n.localize("RYUU.check")} <strong>${event.target.previousSibling.previousSibling.innerText}</strong> ${event.target.innerText}`;
                    }
                    rollCheck(event.target.innerText.replace(/(\[|)STR(\]|)/g, "1d@str").replace(/(\[|)DEX(\]|)/g, "1d@dex").replace(/(\[|)INT(\]|)/g, "1d@int").replace(/(\[|)SPI(\]|)/g, "1d@spi"), text + currentModifiers, modifiers);
                }
                break;
        }

        function rollCheck(formula, flavor, modifiers, journeyDC) {
            if (modifiers !== undefined && modifiers.length > 0) {
                modifiers.forEach(mod => {
                    formula += ` + ${mod}`;
                });
            }
            const r = new Roll(formula, {
                str: str,
                dex: dex,
                int: int,
                spi: spi
            });
            const roll = r.roll();
            const dice = roll.dice;
            const smallDice = dice.filter(r => r.faces < 6);
            const maxRolls = dice.filter(r => r.rolls[0].roll === r.faces);
            const largeCrits = dice.filter(r => r.rolls[0].roll === r.faces || r.rolls[0].roll === 6);
            const fumbleRolls = dice.filter(r => r.rolls[0].roll === 1);
            let crit = false;
            let fumble = false;
            if (dice.length > 1 && ((smallDice !== undefined && maxRolls.length === dice.length) || (largeCrits.length === dice.length))) {
                crit = true;
                flavor += game.i18n.localize("RYUU.rollcrit");
            }
            if (dice.length > 1 && fumbleRolls.length === dice.length) {
                fumble = true;
                flavor += game.i18n.localize("RYUU.rollfumble");
                const players = game.actors.filter(a => a.isPC);
                players.forEach(player => {
                    const pcFumble = player.data.data.attributes.fumble || 0;
                    player.update({
                        "data.attributes.fumble": pcFumble + 1
                    });
                });
            }
            if (journeyDC !== undefined && roll._total >= journeyDC && !fumble) {
                flavor += game.i18n.localize("RYUU.journeypass") + journeyDC;
            } else if ((journeyDC !== undefined && roll._total < journeyDC) || fumble) {
                flavor += game.i18n.localize("RYUU.journeyfail") + journeyDC;
            }
            roll.toMessage({
                flavor: flavor
            });
            return {
                roll: roll._total,
                crit: crit,
                fumble: fumble,
            };
        }
    }

    /* -------------------------------------------- */

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        // Get the type of item to create.
        const type = header.dataset.type;
        // Grab any data associated with this control.
        const data = duplicate(header.dataset);
        // Initialize a default name.
        const name = `New ${type.capitalize()}`;
        // Prepare the item object.
        const itemData = {
            name: name,
            type: type,
            data: data
        };
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.data["type"];

        // Finally, create the item!
        return this.actor.createEmbeddedEntity("OwnedItem", itemData);
    }

    /* -------------------------------------------- */

    /** @override */
    setPosition(options = {}) {
        const position = super.setPosition(options);
        const sheetBody = this.element.find(".sheet-body");
        const bodyHeight = position.height - 192;
        sheetBody.css("height", bodyHeight);
        return position;
    }

    /* -------------------------------------------- */

    /** @override */
    _updateObject(event, formData) {
        // Update the Actor
        return this.object.update(formData);
    }

    /* -------------------------------------------- */

    /** @override */
    async modifyTokenAttribute(attribute, value, isDelta, isBar) {
        if (attribute === "hp") {
            // Get current and delta HP
            const hp = getProperty(this.data.data, attribute);
            const current = hp.value;
            const max = hp.max;
            const delta = isDelta ? value : value - current;

            return this.update({
                "data.hp.value": Math.clamped(hp.value + delta, 0, max)
            });
        } else if (attribute === "mp") {
            // Get current and delta MP
            const mp = getProperty(this.data.data, attribute);
            const current = mp.value;
            const max = mp.max;
            const delta = isDelta ? value : value - current;

            return this.update({
                "data.mp.value": Math.clamped(mp.value + delta, 0, max)
            });
        } else {
            return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
        }
    }
}