import React, { Component } from "react";
import * as PIXI from 'pixi.js';

import ShowKeys from './ShowKeys.js';

import "./App.css";

class App extends Component {
    constructor(props) {
        super(props);
        this.pixiContainer = null;
        this.time = 0.0;
        this.sprites = {};
        this.socket = null;
        this.state = {
            connecting: false,
            connected: false,
            keys: {
                "a": false,
                "s": false,
                "d": false,
                "w": false,
                "j": false,
                "k": false,
                "l": false,
                "i": false,
            },
        };
    }

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
            if (!sprite) {
                console.log(`Adding sprite ${spriteData.id}`);
                sprite = this.SpriteFromTexture(spriteData.texture);
                this.app.stage.addChild(sprite);
                this.sprites[spriteData.id] = sprite;
            }
            sprite.x = spriteData.x * 64;
            sprite.y = spriteData.y * 64;
            spritesToKeep[spriteData.id] = sprite;
        });
        Object.keys(this.sprites).forEach(id => {
            if (!spritesToKeep[id]) {
                console.log(`Removing sprite ${id}`);
                this.app.stage.removeChild(this.sprites[id]);
            }
        });
        this.sprites = spritesToKeep;
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
        if (this.state.keys[key] === undefined) {
            return;
        }
        this.setState(state => ({
            keys: {...state.keys, [key]: true}
        }));
        if (this.socket) {
            this.socket.send(
                JSON.stringify({
                    type: "keyDown",
                    key: key
                })
            );
        }
    }

    onKeyUp = (e) => {
        let key = e.key;
        if (this.state.keys[key] === undefined) {
            return;
        }
        this.setState(state => ({
            keys: {...state.keys, [key]: false}
        }));
        if (this.socket) {
            this.socket.send(
                JSON.stringify({
                    type: "keyUp",
                    key: key
                })
            );
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
        sprite.scale.set(4, 4);
        sprite.anchor.x = 0;
        sprite.anchor.y = 0;
        return sprite;
    };

    Setup = () => {
        this.textures = {}
        for (const textureName of ["hero", "monster"]) {
            console.log("Loading texture: ", textureName);
            const texture = PIXI.loader.resources["rhymuArt.json"].textures[textureName + ".png"];
            texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
            this.textures[textureName] = texture;
        }
    };

    componentDidMount() {
        this.app = new PIXI.Application({
            width: 1200,
            height: 600,
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
                <div className="App-debug">
                    <ShowKeys keys={this.state.keys} />
                </div>
            </div>
        );
    }
}

export default App;
