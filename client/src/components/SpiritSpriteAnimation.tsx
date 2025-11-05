import { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";

interface SpiritSpriteAnimationProps {
  spiritId: string;
  position: "left" | "right";
  size?: number;
}

export function SpiritSpriteAnimation({
  spiritId,
  position,
  size = 256,
}: SpiritSpriteAnimationProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  console.log(`SpiritSpriteAnimation: Rendering with spiritId="${spiritId}", position="${position}"`);

  useEffect(() => {
    if (!canvasRef.current) {
      console.log("SpiritSpriteAnimation: No canvas ref");
      return;
    }

    console.log(`SpiritSpriteAnimation: Initializing for ${spiritId}, position: ${position}`);

    const initPixi = async () => {
      try {
        const app = new PIXI.Application();
        await app.init({
          width: size,
          height: size,
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
          antialias: true,
        });

        if (!canvasRef.current) {
          console.log("SpiritSpriteAnimation: Canvas ref disappeared during init");
          return;
        }

        canvasRef.current.appendChild(app.canvas);
        appRef.current = app;
        console.log("SpiritSpriteAnimation: PixiJS app created");

        if (spiritId === "spirit_c03") {
          console.log("SpiritSpriteAnimation: Loading Ember Fox sprite...");
          const texture = await PIXI.Assets.load("/sprites/cinderpaw_idle.png");
          console.log("SpiritSpriteAnimation: Texture loaded", texture);
          
          const frames: PIXI.Texture[] = [];
          const frameWidth = 128;
          const frameHeight = 128;
          const totalFrames = 8;

          for (let i = 0; i < totalFrames; i++) {
            const frame = new PIXI.Texture({
              source: texture.source,
              frame: new PIXI.Rectangle(
                i * frameWidth,
                0,
                frameWidth,
                frameHeight
              ),
            });
            frames.push(frame);
          }

          console.log(`SpiritSpriteAnimation: Created ${frames.length} frames`);

          const animatedSprite = new PIXI.AnimatedSprite(frames);
          animatedSprite.animationSpeed = 0.1;
          animatedSprite.play();
          
          animatedSprite.anchor.set(0.5);
          animatedSprite.x = size / 2;
          animatedSprite.y = size / 2;
          
          const scale = size / frameWidth;
          animatedSprite.scale.set(scale);

          if (position === "right") {
            animatedSprite.scale.x *= -1;
          }

          app.stage.addChild(animatedSprite);
          console.log("SpiritSpriteAnimation: Animated sprite added to stage");
        }
      } catch (error) {
        console.error("SpiritSpriteAnimation: Error initializing PixiJS:", error);
      }
    };

    initPixi();

    return () => {
      if (appRef.current) {
        console.log("SpiritSpriteAnimation: Cleaning up PixiJS app");
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [spiritId, position, size]);

  if (spiritId !== "spirit_c03") {
    console.log(`SpiritSpriteAnimation: Skipping render for spiritId="${spiritId}" (not Ember Fox)`);
    return null;
  }

  console.log("SpiritSpriteAnimation: Rendering canvas container for Ember Fox");

  return (
    <div
      ref={canvasRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: "relative",
        pointerEvents: "none",
        border: "2px solid red", // Debug: make it visible
      }}
    />
  );
}
