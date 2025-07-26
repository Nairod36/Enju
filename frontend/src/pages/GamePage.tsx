import React, { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";

export function GamePage() {
  const pixiContainer = useRef(null);
  const appRef = useRef(null);

  useEffect(() => {
    // Create PIXI application
    const initApp = async () => {
      const app = new PIXI.Application();
      await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0x87ceeb,
        antialias: true,
      });

      appRef.current = app;
      pixiContainer.current.appendChild(app.canvas);

      // Load sprites
      const skyTexture = await PIXI.Assets.load("/sprites/sky.png");
      const groundTexture = await PIXI.Assets.load("/sprites/image.png");
      const heroSheet = await PIXI.Assets.load("/sprites/hero-sheet.png");
      const shadowTexture = await PIXI.Assets.load("/sprites/shadow.png");
      const rodTexture = await PIXI.Assets.load("/sprites/rod.png");

      // Create background
      // const sky = new PIXI.Sprite(skyTexture);
      // sky.width = app.screen.width;
      // sky.height = app.screen.height;
      // app.stage.addChild(sky);

      // Main container for the game
      const gameContainer = new PIXI.Container();
      gameContainer.x = app.screen.width / 2;
      gameContainer.y = app.screen.height / 2;
      app.stage.addChild(gameContainer);

      // Create ground
      const ground = new PIXI.Sprite(groundTexture);
      ground.anchor.set(0.5);
      ground.x = 0;
      ground.y = 150;
      // Adapter la taille du ground à l'écran
      ground.width = app.screen.width;
      ground.height = app.screen.height;
      gameContainer.addChild(ground);

      // Create hero shadow
      const shadow = new PIXI.Sprite(shadowTexture);
      shadow.anchor.set(0.5);
      shadow.x = 0;
      shadow.y = 100;
      shadow.alpha = 1;
      gameContainer.addChild(shadow);

      // Create hero from spritesheet
      const heroTexture = new PIXI.Texture({
        source: heroSheet,
        frame: new PIXI.Rectangle(0, 0, 32, 32),
      });
      const hero = new PIXI.Sprite(heroTexture);
      hero.anchor.set(0.5);
      hero.x = 0;
      hero.y = 50;
      hero.scale.set(3);
      gameContainer.addChild(hero);

      // Create fishing rod
      const rod = new PIXI.Sprite(rodTexture);
      rod.anchor.set(0.5, 1);
      rod.x = 30;
      rod.y = 30;
      rod.scale.set(2);
      rod.rotation = -0.5;
      gameContainer.addChild(rod);

      // Hero movement variables
      let heroVelocity = { x: 0, y: 0 };
      const moveSpeed = 5;
      const keys = {};

      // Keyboard controls
      const handleKeyDown = (e) => {
        keys[e.code] = true;
      };

      const handleKeyUp = (e) => {
        keys[e.code] = false;
      };

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      // Add game title
      const titleText = new PIXI.Text({
        text: "JEU 2D",
        style: {
          fontFamily: "Arial",
          fontSize: 36,
          fontWeight: "bold",
          fill: 0x2c3e50,
          dropShadow: true,
          dropShadowColor: 0xffffff,
          dropShadowDistance: 2,
          dropShadowAngle: Math.PI / 4,
          dropShadowBlur: 2,
        },
      });
      titleText.x = 20;
      titleText.y = 20;
      app.stage.addChild(titleText);

      // Add controls text
      const controlsText = new PIXI.Text({
        text: "Use ZSQD to move",
        style: {
          fontFamily: "Arial",
          fontSize: 18,
          fill: 0x2c3e50,
        },
      });
      controlsText.x = 20;
      controlsText.y = 70;
      app.stage.addChild(controlsText);

      // Game loop
      app.ticker.add((delta) => {
        // Handle movement
        heroVelocity.x = 0;
        heroVelocity.y = 0;

        if (keys["KeyW"] || keys["ArrowUp"]) heroVelocity.y = -moveSpeed;
        if (keys["KeyS"] || keys["ArrowDown"]) heroVelocity.y = moveSpeed;
        if (keys["KeyA"] || keys["ArrowLeft"]) heroVelocity.x = -moveSpeed;
        if (keys["KeyD"] || keys["ArrowRight"]) heroVelocity.x = moveSpeed;

        // Apply movement
        hero.x += heroVelocity.x;
        hero.y += heroVelocity.y;
        shadow.x = hero.x;
        shadow.y = hero.y + 50;

        // Keep hero within bounds
        const bounds = 200;
        hero.x = Math.max(-bounds, Math.min(bounds, hero.x));
        hero.y = Math.max(-bounds, Math.min(bounds, hero.y));
        shadow.x = hero.x;

        // Animate fishing rod
        rod.x = hero.x + 30;
        rod.y = hero.y - 20;
        rod.rotation = -0.5 + Math.sin(Date.now() * 0.01) * 0.1;
      });

      // Handle resizing
      const handleResize = () => {
        app.renderer.resize(window.innerWidth, window.innerHeight);
        sky.width = app.screen.width;
        sky.height = app.screen.height;
        gameContainer.x = app.screen.width / 2;
        gameContainer.y = app.screen.height / 2;
      };

      window.addEventListener("resize", handleResize);

      // Cleanup
      return () => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        app.destroy(true, true);
        if (pixiContainer.current && app.canvas) {
          pixiContainer.current.removeChild(app.canvas);
        }
      };
    };

    initApp();
  }, []);

  return (
    <div
      ref={pixiContainer}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    />
  );
}

export default GamePage;
