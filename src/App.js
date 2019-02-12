import React, { Component } from "react";
import * as PIXI from 'pixi.js';

import "./App.css";

class App extends Component {
    constructor(props) {
        super(props);
        this.pixiContainer = null;
        this.deltaTime = 0.0;
        this.sprites = {};
        this.socket = null;
        this.state = {
            connecting: false,
            connected: false,
            fire: null,
            move: null,
            health: null,
            score: null,
            potions: null,
        };
    }

    static fireKeys = ["a", "s", "d", "w"];
    static moveKeys = ["j", "k", "l", "i"];

    OnConnected = (socket) => {
        console.log("Connected.");
        this.socket = socket;
        Object.values(this.sprites).forEach(sprite => {
            this.app.stage.removeChild(sprite);
        });
        this.sprites = {};
        this.connectingLabel.hide();
        this.disconnectButton.show();
        this.setState({
            connecting: false,
            connected: true,
        });
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
            this.disconnectButton.hide();
            this.connectButton.show();
            this.setState({
                connecting: false,
                connected: false,
            });
        }
    }

    OnDisconnect = () => {
        console.log("Disconnecting...");
        this.socket.close();
    }

    OnServerRender = (message) => {
        message.sprites.forEach(spriteData => {
            let sprite = this.sprites[spriteData.id];
            if (spriteData.destroyed) {
                console.log(`Removing sprite ${spriteData.id}`);
                this.app.stage.removeChild(this.sprites[spriteData.id]);
            } else {
                if (sprite) {
                    sprite.texture = this.textures[spriteData.texture];
                } else {
                    console.log(`Adding sprite ${spriteData.id}`);
                    sprite = this.SpriteFromTexture(spriteData.texture);
                    sprite.z = spriteData.z;
                    this.app.stage.addChild(sprite);
                    this.sprites[spriteData.id] = sprite;
                }
                sprite.x = (0.5 + spriteData.x) * 16 * 3;
                sprite.y = (0.5 + spriteData.y) * 16 * 3;
                sprite.anchor.set(0.5);
                if (spriteData.spinning) {
                    sprite.spinning = true;
                    sprite.phase = spriteData.phase;
                    sprite.rotation = spriteData.phase * 2 * Math.PI / 4;
                }
                if (spriteData.motion) {
                    sprite.motion = {
                        x: sprite.x,
                        y: sprite.y,
                        dx: spriteData.motion.dx,
                        dy: spriteData.motion.dy,
                    };
                }
            }
        });
        this.app.stage.children.sort((a, b) => a.z - b.z);
        this.setState({
            health: message.health,
            score: message.score,
            potions: message.potions,
        });
        this.scoreValue.text = message.score;
        this.healthValue.text = message.health;
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
        this.connectButton.hide();
        this.connectingLabel.show();
        this.setState(
            {
                connecting: true,
            },
            () => this.Connect()
        );
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

    SpriteFromTexture = (texture) => {
        let sprite = new PIXI.Sprite(this.textures[texture]);
        sprite.scale.set(3, 3);
        sprite.anchor.x = 0;
        sprite.anchor.y = 0;
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

    CreateButtonBody(x, y, width, height, baseColor, v) {
        const body = new PIXI.Graphics();
        body
            .lineStyle(2, baseColor)
            .beginFill(this.ColorLerp(0, baseColor, v))
            .drawRoundedRect(
                x - width / 2,
                y - height / 2,
                width, height, 15
            )
            .endFill();
        body.interactive = true;
        body.buttonMode = true;
        return body;
    }

    CreateLabel = (text, fontSize, x, y, fillColor = 0xffffff, fontWeight = "normal") => {
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
            app: this.app,
            labelText: labelText,
            width: labelText.width,
            height: labelText.height,
            hide: function() {
                this.app.stage.removeChild(this.labelText);
            },
            show: function() {
                this.app.stage.addChild(this.labelText);
            },
            setAnchor: labelText.anchor.set.bind(labelText.anchor),
            set text(value) {
                this.labelText.text = value;
            },
        };
        return label;
    };

    CreateButton = (text, fontSize, x, y, baseColor, onPointerDown) => {
        const label = this.CreateLabel(text, fontSize, x, y);
        label.setAnchor(0.5);
        const width = label.width + fontSize;
        const height = label.height + fontSize;
        const bodyContainer = new PIXI.Container();
        const unlitBody = this.CreateButtonBody(x, y, width, height, baseColor, 0.35);
        const litBody = this.CreateButtonBody(x, y, width, height, baseColor, 0.5);
        bodyContainer.addChild(unlitBody);
        const button = {
            bodyContainer: bodyContainer,
            unlitBody: unlitBody,
            litBody: litBody,
            label: label,
            width: width,
            height: height,
            app: this.app,
            hide: function() {
                this.label.hide();
                this.app.stage.removeChild(this.bodyContainer);
            },
            show: function() {
                const pointer = this.app.renderer.plugins.interaction.mouse.global;
                if (this.litBody.containsPoint(pointer)) {
                    this.bodyContainer.addChild(this.litBody);
                    this.bodyContainer.removeChild(this.unlitBody);
                } else {
                    this.bodyContainer.addChild(this.unlitBody);
                    this.bodyContainer.removeChild(this.litBody);
                }
                this.app.stage.addChild(this.bodyContainer);
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

    Setup = () => {
        this.textures = {}
        for (const textureName of [
            "axe", "bones", "floor", "hero", "monster", "wall",
            "food", "potion", "treasure",
            "exit",
        ]) {
            console.log("Loading texture: ", textureName);
            const texture = PIXI.loader.resources["rhymuArt.json"].textures[textureName + ".png"];
            texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
            this.textures[textureName] = texture;
        }
        const controlPanelCenterX = this.stageWidth + this.controlPanelWidth / 2;
        const connectButtonCenterY = 80;
        this.connectButton = this.CreateButton(
            "Connect", 24,
            controlPanelCenterX, connectButtonCenterY,
            0x00f8ff,
            () => this.OnConnect()
        );
        this.connectingLabel = this.CreateLabel(
            "Connecting...", 24,
            controlPanelCenterX, connectButtonCenterY,
            0x00ff00
        );
        this.connectingLabel.setAnchor(0.5);
        this.disconnectButton = this.CreateButton(
            "Disconnect", 24,
            controlPanelCenterX, connectButtonCenterY,
            0xff0000,
            () => this.OnDisconnect()
        );
        this.connectButton.show();
        const controlPanelLeftAnchorX = this.stageWidth + this.controlPanelWidth * 1 / 2;
        const controlPanelRightAnchorX = this.stageWidth + this.controlPanelWidth * 5 / 8;
        const scoreHealthCenterY = connectButtonCenterY + this.connectButton.height + 20;
        this.scoreLabel = this.CreateLabel(
            "SCORE", 18,
            controlPanelLeftAnchorX, scoreHealthCenterY,
            0xff0000
        );
        this.scoreLabel.setAnchor(1, 0);
        this.scoreValue = this.CreateLabel(
            "0", 28,
            controlPanelLeftAnchorX, scoreHealthCenterY + this.scoreLabel.height,
            0xff0000
        );
        this.scoreValue.setAnchor(1, 0);
        this.healthLabel = this.CreateLabel(
            "HEALTH", 18,
            controlPanelRightAnchorX, scoreHealthCenterY,
            0xff0000
        );
        this.healthValue = this.CreateLabel(
            "0", 28,
            controlPanelRightAnchorX, scoreHealthCenterY + this.healthLabel.height,
            0xff0000
        );
        this.scoreLabel.show();
        this.scoreValue.show();
        this.healthLabel.show();
        this.healthValue.show();
        this.app.ticker.add(delta => this.Tick(delta));
    };

    Tick = (delta) => {
        this.deltaTime += delta / 60;
        let serverTickRate = 10.0;
        let frameDelta = this.deltaTime * serverTickRate;
        let deltaMotion = frameDelta * 16 * 3;
        Object.values(this.sprites).forEach(sprite => {
            if (sprite.spinning) {
                sprite.rotation = (sprite.phase + frameDelta) * 2 * Math.PI / 4;
            }
            if (sprite.motion) {
                sprite.x = sprite.motion.x + sprite.motion.dx * deltaMotion;
                sprite.y = sprite.motion.y + sprite.motion.dy * deltaMotion;
            }
        });
    };

    componentDidMount() {
        this.stageWidth = 720;
        this.controlPanelWidth = 200;
        this.app = new PIXI.Application({
            width: this.stageWidth + this.controlPanelWidth,
            height: 624,
            transparent: false
        });
        this.pixiContainer.appendChild(this.app.view);
        this.app.start();
        PIXI.loader
            .add("rhymuArt.json")
            .load(this.Setup);
    }

    componentWillUnmount() {
        this.app.stop();
    }

    render() {
        let stage = (
            <div
                className="App-stage"
                onKeyDown={this.onKeyDown} onKeyUp={this.onKeyUp} tabIndex="0"
                ref={thisDiv => {
                    this.pixiContainer = thisDiv;
                }}
            />
        );
        return (
            <div className="App">
                {stage}
                <div className="App-stats">
                    <h2>Potions: {this.state.potions}</h2>
                </div>
                <div className="App-debug">
                    <div>Fire: {this.state.fire}</div>
                    <div>Move: {this.state.move}</div>
                </div>
            </div>
        );
    }
}

export default App;
