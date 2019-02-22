import React, { Component } from "react";
import * as PIXI from 'pixi.js';
import Phaser from 'phaser';

import "./App.css";

class App extends Component {
    constructor(props) {
        super(props);
        this.pixiContainer = null;
        this.phaserContainer = null;
        this.deltaTime = 0.0;
        this.pixiSprites = {};
        this.phaserSprites = {};
        this.socket = null;
        this.state = {
            fire: null,
            move: null,
        };
    }

    static serverTickRate = 10.0;
    static atlasName = "rhymuArt";
    static pixiAtlasFile = "rhymuArt.json";
    static phaserAtlasFile = "rhymuArt2.json";
    static fireKeys = ["a", "s", "d", "w"];
    static moveKeys = ["j", "k", "l", "i"];

    OnConnected = (socket) => {
        console.log("Connected.");
        this.socket = socket;
        Object.values(this.pixiSprites).forEach(sprite => {
            this.pixiApp.stage.removeChild(sprite);
        });
        this.pixiSprites = {};
        Object.values(this.phaserSprites).forEach(sprite => {
            sprite.destroy();
        });
        this.phaserSprites = {};
        this.pixiConnectingLabel.hide();
        this.pixiDisconnectButton.show();
        this.phaserConnectingLabel.hide();
        this.phaserDisconnectButton.show();
        this.socket.send(
            JSON.stringify({
                type: "hello",
            })
        );
    }

    OnSocketError = () => {
    }

    OnDisconnected = (socket) => {
        if (this.socket === socket) {
            console.log("Disconnected from the game");
            this.socket = null;
            this.pixiDisconnectButton.hide();
            this.pixiConnectButton.show();
            this.phaserDisconnectButton.hide();
            this.phaserConnectButton.show();
        }
    }

    OnDisconnect = () => {
        console.log("Disconnecting...");
        this.socket.close();
    }

    OnServerRender = (message) => {
        message.sprites.forEach(spriteData => {
            let pixiSprite = this.pixiSprites[spriteData.id];
            let phaserSprite = this.phaserSprites[spriteData.id];
            if (spriteData.destroyed) {
                console.log(`Removing sprite ${spriteData.id}`);
                this.pixiApp.stage.removeChild(this.pixiSprites[spriteData.id]);
                this.phaserSprites[spriteData.id].destroy();
            } else {
                if (pixiSprite) {
                    pixiSprite.texture = this.textures[spriteData.texture];
                } else {
                    console.log(`Adding sprite ${spriteData.id}`);
                    pixiSprite = this.PixiSpriteFromTexture(spriteData.texture);
                    pixiSprite.z = spriteData.z;
                    this.pixiApp.stage.addChild(pixiSprite);
                    this.pixiSprites[spriteData.id] = pixiSprite;
                    phaserSprite = this.PhaserSpriteFromTexture(spriteData.texture);
                    phaserSprite.depth = spriteData.z;
                    this.phaserSprites[spriteData.id] = phaserSprite;
                }
                pixiSprite.x = (0.5 + spriteData.x) * 16 * 2;
                pixiSprite.y = (0.5 + spriteData.y) * 16 * 2;
                phaserSprite.x = (0.5 + spriteData.x) * 16 * 2;
                phaserSprite.y = (0.5 + spriteData.y) * 16 * 2;
                pixiSprite.anchor.set(0.5);
                phaserSprite.setOrigin(0.5);
                if (spriteData.spinning) {
                    pixiSprite.spinning = true;
                    pixiSprite.phase = spriteData.phase;
                    pixiSprite.rotation = spriteData.phase * 2 * Math.PI / 4;
                    phaserSprite.spinning = true;
                    phaserSprite.phase = spriteData.phase;
                    phaserSprite.rotation = spriteData.phase * 2 * Math.PI / 4;
                }
                if (spriteData.motion) {
                    pixiSprite.motion = {
                        x: pixiSprite.x,
                        y: pixiSprite.y,
                        dx: spriteData.motion.dx,
                        dy: spriteData.motion.dy,
                    };
                    phaserSprite.motion = {
                        x: phaserSprite.x,
                        y: phaserSprite.y,
                        dx: spriteData.motion.dx,
                        dy: spriteData.motion.dy,
                    };
                }
            }
        });
        this.pixiApp.stage.children.sort((a, b) => a.z - b.z);
        const numPotions = message.potions;
        this.pixiScoreValue.text = message.score;
        this.pixiHealthValue.text = message.health;
        this.phaserScoreValue.text = message.score;
        this.phaserHealthValue.text = message.health;
        while (this.pixiPotions.length < numPotions) {
            const potion = new PIXI.Sprite(this.textures["potion"]);
            potion.scale.set(2);
            potion.anchor.set(1, 0);
            potion.x = -this.pixiPotions.length * (potion.width - 10);
            potion.y = 0;
            this.pixiPotionsContainer.addChild(potion);
            this.pixiPotions.push(potion);
        }
        while (this.phaserPotions.length > numPotions) {
            const potion = this.phaserPotions.pop();
            potion.destroy();
        }
        while (this.phaserPotions.length < numPotions) {
            const potion = this.PhaserSpriteFromTexture("potion");
            potion.setScale(2);
            potion.setOrigin(1, 0);
            potion.x = -this.phaserPotions.length * (potion.width + 6);
            potion.y = 0;
            this.phaserPotionsContainer.add(potion);
            this.phaserPotions.push(potion);
        }
        while (this.phaserPotions.length > numPotions) {
            const potion = this.phaserPotions.pop();
            this.phaserPotionsContainer.removeChild(potion);
        }
        this.deltaTime = 0.0;
    }

    MESSAGE_HANDLERS = {
        "render": this.OnServerRender
    }

    OnMessageReceived = (message) => {
        let handler = this.MESSAGE_HANDLERS[message["type"]];
        if (!handler) {
            console.warn("Received unrecognized message:", message);
        } else {
            handler(message);
        }
    }

    OnConnect = () => {
        console.log("Connecting...");
        this.pixiConnectButton.hide();
        this.pixiConnectingLabel.show();
        this.phaserConnectButton.hide();
        this.phaserConnectingLabel.show();
        this.Connect();
    }

    onKeyDown = (e) => {
        let key = e.key;
        if (e.repeat) {
            return;
        }
        let fireIndex = App.fireKeys.indexOf(key);
        if (fireIndex >= 0) {
            this.setState({fire: key});
            if (this.socket) {
                this.socket.send(
                    JSON.stringify({
                        type: "fire",
                        key: key
                    })
                );
            }
            return;
        }
        let moveIndex = App.moveKeys.indexOf(key);
        if (moveIndex >= 0) {
            this.setState({move: key});
            if (this.socket) {
                this.socket.send(
                    JSON.stringify({
                        type: "move",
                        key: key
                    })
                );
            }
            return;
        }
        if (key === ' ') {
            if (this.socket) {
                this.socket.send(
                    JSON.stringify({
                        type: "potion",
                    })
                );
            }
        }
    }

    onKeyUp = (e) => {
        let key = e.key;
        if (this.state.fire === key) {
            this.setState({fire: null});
            if (this.socket) {
                this.socket.send(
                    JSON.stringify({
                        type: "fire",
                        key: null
                    })
                );
            }
            return;
        }
        if (this.state.move === key) {
            this.setState({move: null});
            if (this.socket) {
                this.socket.send(
                    JSON.stringify({
                        type: "move",
                        key: null
                    })
                );
            }
            return;
        }
    }

    Connect = () => {
        const host = "localhost";
        const port = 8080;
        let socket = new WebSocket(`ws://${host}:${port}/`);
        socket.addEventListener(
            'open',
            (event) => { this.OnConnected(socket); }
        );
        socket.addEventListener(
            'error',
            (event) => { this.OnSocketError(); }
        );
        socket.addEventListener(
            'close',
            (event) => { this.OnDisconnected(socket); }
        );
        socket.addEventListener(
            'message',
            (event) => { this.OnMessageReceived(JSON.parse(event.data)); }
        );
    }

    PixiSpriteFromTexture = (texture) => {
        let sprite = new PIXI.Sprite(this.textures[texture]);
        sprite.scale.set(2);
        sprite.anchor.x = 0;
        sprite.anchor.y = 0;
        return sprite;
    };

    PhaserSpriteFromTexture = (texture) => {
        let sprite = this.phaser.add.sprite(0, 0, App.atlasName, texture + ".png");
        sprite.setScale(2, 2);
        return sprite;
    };

    RgbToComponents(rgb) {
        const r = (rgb >> 16);
        const g = ((rgb >> 8) & 0xff);
        const b = (rgb & 0xff);
        return [r, g, b];
    }

    RgbFromComponents(r, g, b) {
        return (
            (r << 16)
            | (g << 8)
            | b
        );
    }

    Lerp(x, y, a) {
        return (x + a * (y - x));
    }

    ColorLerp(rgb1, rgb2, a) {
        const [r1, g1, b1] = this.RgbToComponents(rgb1);
        const [r2, g2, b2] = this.RgbToComponents(rgb2);
        return this.RgbFromComponents(
            this.Lerp(r1, r2, a),
            this.Lerp(g1, g2, a),
            this.Lerp(b1, b2, a),
        );
    }

    CreatePixiButtonBody(x, y, width, height, baseColor, v) {
        const bodyGraphic = new PIXI.Graphics();
        bodyGraphic
            .lineStyle(2, baseColor)
            .beginFill(this.ColorLerp(0, baseColor, v))
            .drawRoundedRect(
                0, 0,
                width / 2, height / 2, 6
            )
            .endFill();
        var bodyTexture = this.pixiApp.renderer.generateTexture(
            bodyGraphic,
            PIXI.SCALE_MODES.NEAREST,
            1,
            new PIXI.Rectangle(-1, -1, width / 2 + 3, height / 2 + 3)
        );
        const body = new PIXI.Sprite(bodyTexture);
        body.x = x;
        body.y = y;
        body.anchor.set(0.5);
        body.scale.set(2);
        body.interactive = true;
        body.buttonMode = true;
        return body;
    }

    CreatePixiLabel = (text, fontSize, x, y, fillColor = 0xffffff, fontWeight = "normal") => {
        const labelText = new PIXI.Text(
            text,
            {
                fontSize: fontSize,
                fontWeight: fontWeight,
                fill: fillColor,
            }
        );
        labelText.x = x;
        labelText.y = y;
        const label = {
            pixiApp: this.pixiApp,
            labelText: labelText,
            width: labelText.width,
            height: labelText.height,
            hide: function() {
                this.pixiApp.stage.removeChild(this.labelText);
            },
            show: function() {
                this.pixiApp.stage.addChild(this.labelText);
            },
            setAnchor: labelText.anchor.set.bind(labelText.anchor),
            set text(value) {
                this.labelText.text = value;
            },
        };
        return label;
    };

    CreatePixiButton = (text, fontSize, x, y, baseColor, onPointerDown) => {
        const label = this.CreatePixiLabel(text, fontSize, x, y);
        label.setAnchor(0.5);
        const width = label.width + fontSize;
        const height = label.height + fontSize;
        const bodyContainer = new PIXI.Container();
        const unlitBody = this.CreatePixiButtonBody(x, y, width, height, baseColor, 0.35);
        const litBody = this.CreatePixiButtonBody(x, y, width, height, baseColor, 0.5);
        bodyContainer.addChild(unlitBody);
        const button = {
            bodyContainer: bodyContainer,
            unlitBody: unlitBody,
            litBody: litBody,
            label: label,
            width: width,
            height: height,
            pixiApp: this.pixiApp,
            hide: function() {
                this.label.hide();
                this.pixiApp.stage.removeChild(this.bodyContainer);
            },
            show: function() {
                const pointer = this.pixiApp.renderer.plugins.interaction.mouse.global;
                if (this.litBody.containsPoint(pointer)) {
                    this.bodyContainer.addChild(this.litBody);
                    this.bodyContainer.removeChild(this.unlitBody);
                } else {
                    this.bodyContainer.addChild(this.unlitBody);
                    this.bodyContainer.removeChild(this.litBody);
                }
                this.pixiApp.stage.addChild(this.bodyContainer);
                this.label.show();
            },
        };
        unlitBody.on("pointerover", () => {
            bodyContainer.removeChild(unlitBody);
            bodyContainer.addChild(litBody);
        });
        litBody.on("pointerdown", onPointerDown);
        litBody.on("pointerout", () => {
            bodyContainer.removeChild(litBody);
            bodyContainer.addChild(unlitBody);
        });
        return button;
    };

    PixiSetup = () => {
        this.textures = {}
        for (const textureName of [
            "axe", "bones", "floor", "hero", "monster", "wall",
            "food", "potion", "treasure",
            "exit",
        ]) {
            console.log("Loading texture: ", textureName);
            const texture = PIXI.loader.resources[App.pixiAtlasFile].textures[textureName + ".png"];
            texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
            this.textures[textureName] = texture;
        }
        const controlPanelCenterX = this.stageWidth + this.controlPanelWidth / 2;
        const connectButtonCenterY = 80;
        this.pixiConnectButton = this.CreatePixiButton(
            "Connect", 24,
            controlPanelCenterX, connectButtonCenterY,
            0x00f8ff,
            () => this.OnConnect()
        );
        this.pixiConnectingLabel = this.CreatePixiLabel(
            "Connecting...", 24,
            controlPanelCenterX, connectButtonCenterY,
            0x00ff00
        );
        this.pixiConnectingLabel.setAnchor(0.5);
        this.pixiDisconnectButton = this.CreatePixiButton(
            "Disconnect", 24,
            controlPanelCenterX, connectButtonCenterY,
            0xff0000,
            () => this.OnDisconnect()
        );
        this.pixiConnectButton.show();
        const controlPanelLeftAnchorX = this.stageWidth + this.controlPanelWidth * 1 / 2;
        const controlPanelRightAnchorX = this.stageWidth + this.controlPanelWidth * 5 / 8;
        const scoreHealthTop = connectButtonCenterY + this.pixiConnectButton.height / 2 + 20;
        this.scoreLabel = this.CreatePixiLabel(
            "SCORE", 18,
            controlPanelLeftAnchorX, scoreHealthTop,
            0xff0000
        );
        this.scoreLabel.setAnchor(1, 0);
        this.pixiScoreValue = this.CreatePixiLabel(
            "0", 28,
            controlPanelLeftAnchorX, scoreHealthTop + this.scoreLabel.height,
            0xff0000
        );
        this.pixiScoreValue.setAnchor(1, 0);
        this.healthLabel = this.CreatePixiLabel(
            "HEALTH", 18,
            controlPanelRightAnchorX, scoreHealthTop,
            0xff0000
        );
        const healthValueTop = scoreHealthTop + this.healthLabel.height;
        this.pixiHealthValue = this.CreatePixiLabel(
            "0", 28,
            controlPanelRightAnchorX, healthValueTop,
            0xff0000
        );
        const potionsTop = healthValueTop + this.pixiHealthValue.height;
        this.pixiPotions = [];
        this.pixiPotionsContainer = new PIXI.Container();
        this.pixiPotionsContainer.x = this.stageWidth + this.controlPanelWidth - 5;
        this.pixiPotionsContainer.y = potionsTop;
        this.pixiApp.stage.addChild(this.pixiPotionsContainer);
        this.scoreLabel.show();
        this.pixiScoreValue.show();
        this.healthLabel.show();
        this.pixiHealthValue.show();
        this.pixiApp.ticker.add(delta => this.PixiTick(delta));
    };

    CreatePhaserButtonBody = (name, x, y, z, width, height, baseColor, v) => {
        const bodyGraphic = this.phaser.add.graphics();
        bodyGraphic
            .lineStyle(2, baseColor)
            .fillStyle(this.ColorLerp(0, baseColor, v))
            .fillRoundedRect(
                0, 0,
                width / 2, height / 2, 6
            )
            .strokeRoundedRect(
                1, 1,
                width / 2 - 2, height / 2 - 2, 6
            );
        bodyGraphic.generateTexture(name, width / 2, height / 2);
        bodyGraphic.destroy();
        const body = this.phaser.add.sprite(x, y, name);
        body.depth = z;
        body.setScale(2);
        body.setInteractive();
        return body;
    };

    CreatePhaserLabel = (text, fontSize, x, y, z, fillColor = "#fff", fontWeight = "normal") => {
        const labelText = this.phaser.add.text(
            x,
            y,
            text,
            {
                fontFamily: "Arial",
                fontSize: fontSize,
                fontWeight: fontWeight,
                color: fillColor,
            }
        );
        labelText.depth = z + 1;
        const label = {
            labelText: labelText,
            width: labelText.width,
            height: labelText.height,
            hide: function() {
                this.labelText.setVisible(false);
            },
            show: function() {
                this.labelText.setVisible(true);
            },
            setAnchor: labelText.setOrigin.bind(labelText),
            set text(value) {
                this.labelText.setText(value);
            },
        };
        return label;
    };

    CreatePhaserButton = (name, text, fontSize, x, y, z, baseColor, onPointerDown) => {
        const label = this.CreatePhaserLabel(text, fontSize, x, y, z);
        label.setAnchor(0.5);
        const width = label.width + fontSize;
        const height = label.height + fontSize;
        // const bodyContainer = this.phaser.add.container(0, 0);
        const unlitBody = this.CreatePhaserButtonBody(name + "Unlit", x, y, z, width, height, baseColor, 0.35);
        const litBody = this.CreatePhaserButtonBody(name + "Lit", x, y, z, width, height, baseColor, 0.5);
        label.hide();
        unlitBody.setVisible(false);
        litBody.setVisible(false);
        // bodyContainer.add(label.labelText);
        // bodyContainer.add(litBody);
        // bodyContainer.add(unlitBody);
        const button = {
            // bodyContainer: bodyContainer,
            unlitBody: unlitBody,
            litBody: litBody,
            label: label,
            width: width,
            height: height,
            phaser: this.phaser,
            visible: true,
            hide: function() {
                this.label.hide();
                // this.bodyContainer.setVisible(false);
                this.litBody.setVisible(false);
                this.unlitBody.setVisible(false);
                this.visible = false;
            },
            show: function() {
                const pointer = this.phaser.input.activePointer;
                if (this.litBody.getBounds().contains(pointer.x, pointer.y)) {
                    this.litBody.setVisible(true);
                    this.unlitBody.setVisible(false);
                } else {
                    this.litBody.setVisible(false);
                    this.unlitBody.setVisible(true);
                }
                // this.bodyContainer.setVisible(true);
                this.label.show();
                this.visible = true;
            },
        };
        unlitBody.on("pointerover", () => {
            if (button.visible) {
                litBody.setVisible(true);
                unlitBody.setVisible(false);
            }
        });
        litBody.on("pointerdown", () => {
            if (button.visible) {
                onPointerDown();
            }
        });
        litBody.on("pointerout", () => {
            if (button.visible) {
                litBody.setVisible(false);
                unlitBody.setVisible(true);
            }
        });
        return button;
    };

    PhaserSetup = () => {
        const controlPanelCenterX = this.stageWidth + this.controlPanelWidth / 2;
        const connectButtonCenterY = 80;
        this.phaserConnectButton = this.CreatePhaserButton(
            "Connect", "Connect", 24,
            controlPanelCenterX, connectButtonCenterY, 0,
            0x00f8ff,
            () => this.OnConnect()
        );
        this.phaserConnectingLabel = this.CreatePhaserLabel(
            "Connecting...", 24,
            controlPanelCenterX, connectButtonCenterY, 0,
            "#0f0"
        );
        this.phaserConnectingLabel.setAnchor(0.5);
        this.phaserConnectingLabel.hide();
        this.phaserDisconnectButton = this.CreatePhaserButton(
            "Disconnect", "Disconnect", 24,
            controlPanelCenterX, connectButtonCenterY, 0,
            0xff0000,
            () => this.OnDisconnect()
        );
        this.phaserConnectButton.show();
        const controlPanelLeftAnchorX = this.stageWidth + this.controlPanelWidth * 1 / 2;
        const controlPanelRightAnchorX = this.stageWidth + this.controlPanelWidth * 5 / 8;
        const scoreHealthTop = connectButtonCenterY + this.phaserConnectButton.height / 2 + 20;
        this.scoreLabel = this.CreatePhaserLabel(
            "SCORE", 18,
            controlPanelLeftAnchorX, scoreHealthTop, 0,
            "#f00"
        );
        this.scoreLabel.setAnchor(1, 0);
        this.phaserScoreValue = this.CreatePhaserLabel(
            "0", 28,
            controlPanelLeftAnchorX, scoreHealthTop + this.scoreLabel.height, 0,
            "#f00"
        );
        this.phaserScoreValue.setAnchor(1, 0);
        this.healthLabel = this.CreatePhaserLabel(
            "HEALTH", 18,
            controlPanelRightAnchorX, scoreHealthTop, 0,
            "#f00"
        );
        const healthValueTop = scoreHealthTop + this.healthLabel.height;
        this.phaserHealthValue = this.CreatePhaserLabel(
            "0", 28,
            controlPanelRightAnchorX, healthValueTop, 0,
            "#f00"
        );
        const potionsTop = healthValueTop + this.phaserHealthValue.height;
        this.phaserPotions = [];
        this.phaserPotionsContainer = this.phaser.add.container(
            this.stageWidth + this.controlPanelWidth - 5,
            potionsTop
        );
        this.scoreLabel.show();
        this.phaserScoreValue.show();
        this.healthLabel.show();
        this.phaserHealthValue.show();
    };

    PixiTick = (delta) => {
        this.deltaTime += delta / 60;
        let frameDelta = this.deltaTime * App.serverTickRate;
        let deltaMotion = frameDelta * 16 * 2;
        Object.values(this.pixiSprites).forEach(sprite => {
            if (sprite.spinning) {
                sprite.rotation = (sprite.phase + frameDelta) * 2 * Math.PI / 4;
            }
            if (sprite.motion) {
                sprite.x = sprite.motion.x + sprite.motion.dx * deltaMotion;
                sprite.y = sprite.motion.y + sprite.motion.dy * deltaMotion;
            }
        });
    };

    PhaserTick = (delta) => {
        let frameDelta = this.deltaTime * App.serverTickRate;
        let deltaMotion = frameDelta * 16 * 2;
        Object.values(this.phaserSprites).forEach(sprite => {
            if (sprite.spinning) {
                sprite.rotation = (sprite.phase + frameDelta) * 2 * Math.PI / 4;
            }
            if (sprite.motion) {
                sprite.x = sprite.motion.x + sprite.motion.dx * deltaMotion;
                sprite.y = sprite.motion.y + sprite.motion.dy * deltaMotion;
            }
        });
    }

    createPixiStage = () => {
        this.pixiApp = new PIXI.Application({
            width: this.stageWidth + this.controlPanelWidth,
            height: this.stageHeight,
            transparent: false
        });
        this.pixiContainer.appendChild(this.pixiApp.view);
        this.pixiApp.start();
        PIXI.loader
            .add(App.pixiAtlasFile)
            .load(this.PixiSetup);
    };

    createPhaserStage = () => {
        const config = {
            type: Phaser.AUTO,
            input: {
                keyboard: true,
                mouse: true,
                touch: true,
            },
            parent: "phaserContainer",
            pixelArt: true,
            width: this.stageWidth + this.controlPanelWidth,
            height: this.stageHeight,
            scene: {
                init: this.phaserInit(this),
                preload: this.phaserPreload(this),
                create: this.pharserCreate(this),
                update: this.pharserUpdate(this),
            }
        };
        new Phaser.Game(config);
        console.log("phaser:", this.phaser);
    };

    phaserInit(app) {
        return function() {
            app.phaser = this;
            var phaser = this;
        };
    }

    phaserPreload(app) {
        return function() {
            var phaser = this;
            phaser.load.multiatlas(App.atlasName, App.phaserAtlasFile);
        };
    }

    pharserCreate(app) {
        return function() {
            var phaser = this;
            app.PhaserSetup();
        };
    }

    pharserUpdate(app) {
        return function() {
            app.PhaserTick();
        };
    }

    componentDidMount() {
        this.stageWidth = 480;
        this.stageHeight = 416;
        this.controlPanelWidth = 200;
        this.createPixiStage();
        this.createPhaserStage();
    }

    componentWillUnmount() {
        this.pixiApp.stop();
    }

    render() {
        let stages = (
            <React.Fragment>
                <div
                    className="App-stage-pixi"
                    onKeyDown={this.onKeyDown} onKeyUp={this.onKeyUp} tabIndex="0"
                    ref={thisDiv => {
                        this.pixiContainer = thisDiv;
                    }}
                />
                <div
                    className="App-stage-phaser"
                    id="phaserContainer"
                />
            </React.Fragment>
        );
        return (
            <div className="App">
                {stages}
            </div>
        );
    }
}

export default App;
