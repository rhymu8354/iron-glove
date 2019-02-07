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
        let spritesToKeep = {};
        message.sprites.forEach(spriteData => {
            let sprite = this.sprites[spriteData.id];
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
            if (spriteData.motion) {
                sprite.rotation = spriteData.motion.phase * 2 * Math.PI / 4;
                sprite.motion = {
                    x: sprite.x,
                    y: sprite.y,
                    dx: spriteData.motion.dx,
                    dy: spriteData.motion.dy,
                    phase: spriteData.motion.phase,
                };
            }
            spritesToKeep[spriteData.id] = sprite;
        });
        Object.keys(this.sprites).forEach(id => {
            if (!spritesToKeep[id]) {
                console.log(`Removing sprite ${id}`);
                this.app.stage.removeChild(this.sprites[id]);
            }
        });
        this.app.stage.children.sort((a, b) => a.z - b.z);
        this.sprites = spritesToKeep;
        this.setState({
            health: message.health,
            score: message.score,
            potions: message.potions,
        });
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

    Setup = () => {
        this.textures = {}
        for (const textureName of [
            "axe", "bones", "floor", "hero", "monster", "wall",
            "food", "potion", "treasure",
        ]) {
            console.log("Loading texture: ", textureName);
            const texture = PIXI.loader.resources["rhymuArt.json"].textures[textureName + ".png"];
            texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
            this.textures[textureName] = texture;
        }
        this.app.ticker.add(delta => this.Tick(delta));
    };

    Tick = (delta) => {
        this.deltaTime += delta / 60;
        let serverTickRate = 10.0;
        let frameDelta = this.deltaTime * serverTickRate;
        let deltaMotion = frameDelta * 16 * 3;
        Object.values(this.sprites).forEach(sprite => {
            if (sprite.motion) {
                sprite.x = sprite.motion.x + sprite.motion.dx * deltaMotion;
                sprite.y = sprite.motion.y + sprite.motion.dy * deltaMotion;
                sprite.rotation = (sprite.motion.phase + frameDelta) * 2 * Math.PI / 4;
            }
        });
    };

    componentDidMount() {
        this.app = new PIXI.Application({
            width: 720,
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
        let connection = null;
        if (this.state.connected) {
            connection = (
                <div>
                    <button onClick={() => this.OnDisconnect(this.socket)}>Disconnect</button>
                </div>
            );
        } else if (this.state.connecting) {
            connection = (
                <div>
                    Connecting...
                </div>
            );
        } else {
            connection = (
                <div>
                    <button onClick={() => this.OnConnect()}>Connect</button>
                </div>
            );
        }
        return (
            <div className="App">
                {stage}
                {connection}
                <div className="App-stats">
                    <h2>Score: {this.state.score}</h2>
                    <h2>Health: {this.state.health}</h2>
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
