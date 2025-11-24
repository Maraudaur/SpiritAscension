import { useEffect, useRef, useState } from "react"; // 1. Import useState
import { getBaseSpirit } from "@/lib/spiritUtils";

// Import PIXI modules
import { Application } from "@pixi/app";
import { Sprite } from "@pixi/sprite";
import { AnimatedSprite } from "@pixi/sprite-animated";
import { Texture, Rectangle } from "@pixi/core";
import { Assets } from "@pixi/assets";
import { Graphics } from "@pixi/graphics";
import { PixelateFilter } from "@pixi/filter-pixelate";
import type { TickerCallback } from "@pixi/ticker";

interface SpiritSpriteAnimationProps {
  spiritId: string;
  position: "left" | "right";
  size?: number;
  isTakingDamage: boolean;
  isDefeated: boolean;
  onDefeatAnimationComplete?: () => void;
}

export function SpiritSpriteAnimation({
  spiritId,
  position,
  size = 256,
  isTakingDamage,
  isDefeated,
  onDefeatAnimationComplete,
}: SpiritSpriteAnimationProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const spriteRef = useRef<AnimatedSprite | null>(null);
  const originalXRef = useRef<number>(0);
  const tickersRef = useRef<Set<TickerCallback<any>>>(new Set());

  // --- 2. Add internal state to track hit animation ---
  const [isAnimatingHit, setIsAnimatingHit] = useState(false);

  // Helper to safely add and track tickers
  const addTicker = (fn: TickerCallback<any>) => {
    if (appRef.current) {
      tickersRef.current.add(fn);
      appRef.current.ticker.add(fn);
    }
  };

  // Helper to safely remove and untrack tickers
  const removeTicker = (fn: TickerCallback<any>) => {
    if (appRef.current) {
      tickersRef.current.delete(fn);
      appRef.current.ticker.remove(fn);
    }
  };

  // --- Main PIXI Setup Effect ---
  useEffect(() => {
    if (!canvasRef.current) return;

    // Reset hit animation state on new spirit
    setIsAnimatingHit(false);

    const spiritData = getBaseSpirit(spiritId);
    if (!spiritData || !spiritData.spriteConfig) {
      console.error(`SpiritSpriteAnimation: No spriteConfig for ${spiritId}`);
      return;
    }

    const { textureUrl, frameWidth, frameHeight, totalFrames, animationSpeed } =
      spiritData.spriteConfig;

    let app: Application;

    const initPixi = async () => {
      try {
        app = new Application({
          width: size,
          height: size,
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
          antialias: true,
        });

        if (!canvasRef.current) return;

        canvasRef.current.appendChild(app.view as HTMLCanvasElement);
        appRef.current = app;

        const texture = await Assets.load(textureUrl);
        const frames: Texture[] = [];
        for (let i = 0; i < totalFrames; i++) {
          const frameTexture = new Texture(
            texture.baseTexture,
            new Rectangle(i * frameWidth, 0, frameWidth, frameHeight),
          );
          frames.push(frameTexture);
        }

        const animatedSprite = new AnimatedSprite(frames);
        animatedSprite.animationSpeed = animationSpeed;
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
        spriteRef.current = animatedSprite;
        originalXRef.current = animatedSprite.x;

        // --- SUMMON VFX ---
        const summonDelay = 1200; // 1.2 seconds

        setTimeout(() => {
          const currentApp = appRef.current;
          if (!currentApp) {
            return;
          }

          const flash = new Graphics();
          flash.beginFill(0xffffff);
          flash.drawCircle(0, 0, size / 2);
          flash.endFill();
          flash.x = size / 2;
          flash.y = size / 2;
          flash.scale.set(0);
          flash.alpha = 0.8;
          currentApp.stage.addChild(flash);

          let elapsed = 0;
          const duration = 300;

          const spawnTicker: TickerCallback<any> = (delta) => {
            // Re-check the ref in case it was destroyed during the anim
            if (!appRef.current) {
              removeTicker(spawnTicker); // Stop the ticker
              return;
            }

            elapsed += appRef.current.ticker.elapsedMS; // <-- Use appRef.current
            const progress = Math.min(elapsed / duration, 1);
            // ... (rest of ticker)

            if (progress === 1) {
              removeTicker(spawnTicker);
              flash.destroy();
            }
          };
          addTicker(spawnTicker);
        }, summonDelay); // <-- Apply the delay here
      } catch (error) {
        console.error(
          "SpiritSpriteAnimation: Error initializing PixiJS:",
          error,
        );
      }
    };

    initPixi();

    return () => {
      if (appRef.current) {
        tickersRef.current.forEach((ticker) => {
          appRef.current?.ticker.remove(ticker);
        });
        tickersRef.current.clear();
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      spriteRef.current = null;
      originalXRef.current = 0;
    };
  }, [spiritId, position, size]);

  // --- Damage Effect (Shake/Flash) ---
  useEffect(() => {
    // 3. We remove the '!isDefeated' check. We ALWAYS play the hit anim.
    if (isTakingDamage && spriteRef.current) {
      // --- 4. Tell the component we are animating ---
      setIsAnimatingHit(true);

      const sprite = spriteRef.current;
      const timeouts: NodeJS.Timeout[] = [];

      sprite.tint = 0xff0000; // Red flash

      const shakeTimeline = [
        { dx: -6, delay: 0 },
        { dx: 6, delay: 80 },
        { dx: -6, delay: 160 },
        { dx: 6, delay: 240 },
        { dx: 0, delay: 320 },
      ];

      shakeTimeline.forEach(({ dx, delay }) => {
        const timeoutId = setTimeout(() => {
          if (spriteRef.current) {
            spriteRef.current.x = originalXRef.current + dx;
          }
        }, delay);
        timeouts.push(timeoutId);
      });

      const resetTimeout = setTimeout(() => {
        if (spriteRef.current) {
          spriteRef.current.tint = 0xffffff; // Reset tint
        }
        // --- 5. We are done animating ---
        setIsAnimatingHit(false);
      }, 400); // After shake is done
      timeouts.push(resetTimeout);

      return () => {
        timeouts.forEach(clearTimeout);
        // If effect is cancelled, make sure to reset state AND tint
        if (spriteRef.current) {
          spriteRef.current.tint = 0xffffff; // Reset tint to prevent stuck red
        }
        setIsAnimatingHit(false);
      };
    }
  }, [isTakingDamage]); // This effect *only* runs when isTakingDamage changes

  // --- DEFEAT VFX (Dissolve) ---
  useEffect(() => {
    // --- 6. Now this effect waits for isAnimatingHit to be false ---
    if (isDefeated && !isAnimatingHit && spriteRef.current && appRef.current) {
      const sprite = spriteRef.current;
      const app = appRef.current;

      tickersRef.current.forEach((ticker) => {
        app.ticker.remove(ticker);
      });
      tickersRef.current.clear();

      const filter = new PixelateFilter(1);
      sprite.filters = [filter];

      let elapsed = 0;
      const duration = 1000; // 1 second dissolve

      const defeatTicker: TickerCallback<any> = (delta) => {
        elapsed += app.ticker.elapsedMS;
        const progress = Math.min(elapsed / duration, 1);

        filter.size = 1 + progress * 19;
        sprite.alpha = 1 - progress;

        if (progress === 1) {
          removeTicker(defeatTicker);
          sprite.visible = false;
          if (onDefeatAnimationComplete) {
            onDefeatAnimationComplete();
          }
        }
      };

      addTicker(defeatTicker);

      return () => {
        removeTicker(defeatTicker);
      };
    }
    // --- 7. Add isAnimatingHit to the dependency array ---
  }, [isDefeated, isAnimatingHit]);

  return (
    <div
      ref={canvasRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: "relative",
        pointerEvents: "none",
      }}
    />
  );
}
