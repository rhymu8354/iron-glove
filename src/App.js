import React, { Component } from "react";
import * as PIXI from 'pixi.js';

import ShowKeys from './ShowKeys.js';

import "./App.css";

class App extends Component {
    constructor(props) {
        super(props);
        this.pixiContainer = null;
        this.time = 0.0;
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

    MESSAGE_HANDLERS = {
    };

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
    }

    onKeyUp = (e) => {
        let key = e.key;
        if (this.state.keys[key] === undefined) {
            return;
        }
        this.setState(state => ({
            keys: {...state.keys, [key]: false}
        }));
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

    Setup = () => {
        // const avatarTexture = PIXI.loader.resources["avatar.png"].texture;
        // avatarTexture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        // this.avatar = new PIXI.Sprite(avatarTexture);
        // this.avatar.anchor.x = 0.5;
        // this.avatar.anchor.y = 0.5;
        // this.avatar.x = this.app.view.width / 2;
        // this.avatar.y = this.app.view.height / 2;
        // this.app.stage.addChild(this.avatar);
        // this.app.ticker.add(delta => this.Tick(delta));
    };

    Tick = (delta) => {
        this.time += delta / 60;
        // this.avatar.rotation = this.time * 2 * Math.PI / 2;
        // const scale = 2.0 + Math.sin(this.time * 2 * Math.PI) * 1;
        // this.avatar.scale.set(scale, scale);
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
//            .add("avatar.png")
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
