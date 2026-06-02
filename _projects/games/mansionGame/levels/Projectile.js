import Character from '@assets/js/GameEnginev1.1/essentials/Character.js';
import showDeathScreen from './DeathScreen.js';
import { updatePlayerHealthBar } from './HealthBars.js';
import { spawnPlayerDamageEffect } from './DamageEffects.js';

/*
    Projectile class for the Reaper boss fireball & arrow attacks + player attack
    - Moves towards it's target
    - Damages target once reached, then self-destroys
    - Three sub attack types: FIREBALL, ARROW, and PLAYER
*/

class Projectile extends Character {
    static spriteCache = new Map();

    constructor(gameEnv = null, targetx, targety, sourcex, sourcey, type, options = {}) {
        super({ id: type }, gameEnv);

        this.source_coords = { x: sourcex, y: sourcey };
        this.target_coords = { x: targetx, y: targety };
        this.type = type;
        this.owner = options.owner || null;

        // Get the main path
        const path = gameEnv.path;

        // Calculate angle and velocity to move in a straight line
        const dx = targetx - sourcex;
        const dy = targety - sourcey;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        this.speed = type === "PUMPKIN" ? 4 : 5; // adjust as needed
        this.velocity = {
            x: (dx / distance) * this.speed,
            y: (dy / distance) * this.speed
        };

        if (type === "PUMPKIN") {
            this.flightProgress = 0;
            this.flightDuration = Math.max(16, Math.floor(distance / this.speed));
            this.arcHeight = Math.min(220, distance * 0.35);
            this.spinAngle = 0;
        }

        this.revComplete = false;

        // Load sprite/image based on type
        this.frameIndex = 0;
        this.frameCount = 1; // single frame

        if (type === "ARROW" || type === "PLAYER") {
            this.width = 60;
            this.height = 25;
            this.setSprite(path + "/images/projects/mansionGame/arrow.png");
        } else if (type === "PUMPKIN") {
            this.width = 48;
            this.height = 48;
            this.setSprite(path + "/images/projects/mansionGame/pumpkin.png");
        } else if (type === "FIREBALL") {
            this.width = 64;
            this.height = 44;
            this.setSprite(path + "/images/projects/mansionGame/staticfireball.png");
        }
        this.isAnimated = false;

        // Start at source position
        this.position = { x: sourcex, y: sourcey };

        // These projectile canvases stay the same size for their whole lifetime.
        this.canvas.width = Math.max(1, Math.floor(this.width));
        this.canvas.height = Math.max(1, Math.floor(this.height));

        // Performance optimization: cache gameObjects and refresh periodically
        this._cachedEnemies = null;
        this._cachedPlayers = null;
        this._cacheRefreshTime = Date.now();
        this._cacheRefreshInterval = 500; // Refresh cache every 500ms
        this._damageCheckReady = false;
        this._lastDamageCheck = Date.now();
        this._frameAdvanceCounter = 0;
    }

    setSprite(src) {
        const cachedSprite = Projectile.spriteCache.get(src);
        if (cachedSprite) {
            this.spriteSheet = cachedSprite;
            this.imageLoaded = cachedSprite.complete;
            if (!this.imageLoaded) {
                cachedSprite.addEventListener('load', () => {
                    this.imageLoaded = true;
                }, { once: true });
            }
            return;
        }

        const sprite = new Image();
        sprite.onload = () => {
            this.imageLoaded = true;
        };
        sprite.src = src;
        Projectile.spriteCache.set(src, sprite);
        this.spriteSheet = sprite;
    }

    update() {
        // Move projectile
        if (this.type === 'PUMPKIN') {
            this.flightProgress = Math.min(1, this.flightProgress + 1 / this.flightDuration);
            const t = this.flightProgress;
            const baseX = this.source_coords.x + (this.target_coords.x - this.source_coords.x) * t;
            const baseY = this.source_coords.y + (this.target_coords.y - this.source_coords.y) * t;
            const arcOffset = Math.sin(Math.PI * t) * this.arcHeight;
            this.position.x = baseX;
            this.position.y = baseY - arcOffset;

            if (t >= 1) {
                this.revComplete = true;
                this.destroy();
                return;
            }
        } else {
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
        }

        // Check if offscreen (more lenient bounds to allow some off-screen projectiles)
        const margin = 50;
        if (
            this.position.x < -margin || this.position.x > this.gameEnv.innerWidth + margin ||
            this.position.y < -margin || this.position.y > this.gameEnv.innerHeight + margin
        ) {
            this.revComplete = true;
            this.destroy();
            return;
        }

        // Draw
        this.draw();

        // Only check damage if we have the necessary data (lazy initialization)
        if (!this._damageCheckReady) {
            this._damageCheckReady = true;
            this._lastDamageCheck = Date.now();
        }

        // Throttle damage checks to reduce per-frame calculations
        // This is safe because projectiles move fast enough
        const now = Date.now();
        if (now - this._lastDamageCheck > 30) { // Check every ~30ms instead of every frame
            this._lastDamageCheck = now;
            this.execDamage();
        }
    }

    draw() {
        const ctx = this.ctx;
        this.clearCanvas();

        if (!this.imageLoaded) {
            return;  // Don't try to draw until image is loaded
        }

        // Rotate projectile to face travel direction
        const travelAngle = Math.atan2(this.velocity.y, this.velocity.x);
        const baseAngle = (this.type === 'ARROW' || this.type === 'PLAYER') ? Math.PI : 0;
        let drawAngle = travelAngle - baseAngle;

        const srcW = this.spriteSheet.naturalWidth || this.spriteSheet.width;
        const srcH = this.spriteSheet.naturalHeight || this.spriteSheet.height;
        const dstW = Math.max(1, Math.floor(this.width));
        const dstH = Math.max(1, Math.floor(this.height));
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        // Handle special rotation for pumpkins
        if (this.type === 'PUMPKIN') {
            this.spinAngle = (this.spinAngle + 0.25) % (Math.PI * 2);
            drawAngle = this.spinAngle;
        }

        // Draw with rotation
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(drawAngle);

        if (this.isAnimated && this.spriteSheet.complete) {
            const frameWidth = Math.floor(this.spriteSheet.width / this.frameCols);
            const frameHeight = Math.floor(this.spriteSheet.height / this.frameRows);
            const col = this.frameIndex % this.frameCols;
            const row = Math.floor(this.frameIndex / this.frameRows);

            ctx.drawImage(
                this.spriteSheet,
                col * frameWidth, row * frameHeight, frameWidth, frameHeight,
                -dstW / 2, -dstH / 2, dstW, dstH
            );

            // Advance frame every 2 calls to reduce animation overhead
            if (this._frameAdvanceCounter === undefined) this._frameAdvanceCounter = 0;
            if (++this._frameAdvanceCounter >= 2) {
                this._frameAdvanceCounter = 0;
                this.frameIndex = (this.frameIndex + 1) % this.frameCount;
            }
        } else if (this.spriteSheet.complete) {
            ctx.drawImage(
                this.spriteSheet,
                0, 0, srcW, srcH,
                -dstW / 2, -dstH / 2, dstW, dstH
            );
        }

        ctx.restore();

        // Draw to screen
        this.setupCanvas();
    }

    // Deal damage to the player
    execDamage() {
        // Do not apply damage while the battleroom intro/fade is running.
        if (typeof window !== 'undefined' && window.__battleRoomFadeComplete === false) {
            return;
        }

        const PLAYER_HIT_DISTANCE = 50;
        const ARROW_DAMAGE = 20;
        const PLAYER_DAMAGE = 120;
        const FIREBALL_DAMAGE = 20;
        const PUMPKIN_DAMAGE = 20;
        const PUMPKIN_SPLASH_DAMAGE = 20;

        const baseDamage = this.type === "FIREBALL" ? FIREBALL_DAMAGE : 
                          this.type === "ARROW" ? ARROW_DAMAGE : 
                          this.type === "PUMPKIN" ? PUMPKIN_DAMAGE : PLAYER_DAMAGE;
        
        const damageMultiplier = this.owner && typeof this.owner.getDamageMultiplier === 'function'
            ? this.owner.getDamageMultiplier()
            : 1;
        const DAMAGE_DEALT = Math.round(baseDamage * damageMultiplier);
        const pumpkinSplashDamage = Math.round(PUMPKIN_SPLASH_DAMAGE * damageMultiplier);

        const isPlayerProjectile = this.type === 'PLAYER' || this.type === 'PUMPKIN';

        // Periodically refresh cache to handle new/destroyed objects
        const now = Date.now();
        if (now - this._cacheRefreshTime > this._cacheRefreshInterval) {
            this._cacheRefreshTime = now;
            this._cachedEnemies = null;
            this._cachedPlayers = null;
        }

        if (isPlayerProjectile) {
            // Cache enemies list to avoid repeated filtering
            if (!this._cachedEnemies) {
                this._cachedEnemies = this.gameEnv.gameObjects.filter(obj =>
                    obj.constructor.name === 'Boss' || obj.constructor.name === 'Zombie'
                );
            }
            const enemies = this._cachedEnemies;
            if (enemies.length === 0) return null;

            // Find closest enemy (only check first one if boss exists)
            let hitEnemy = null;
            for (let i = 0; i < enemies.length; i++) {
                const enemy = enemies[i];
                const dx = (enemy.position.x + enemy.width / 2) - this.position.x;
                const dy = (enemy.position.y + enemy.height / 2) - this.position.y;
                const distSq = dx * dx + dy * dy;
                const threshold = enemy.constructor.name === 'Boss' ? 9025 : 2025; // squared distances
                if (distSq <= threshold) {
                    hitEnemy = enemy;
                    break;
                }
            }

            if (!hitEnemy) return null;

            this.revComplete = true;
            this.destroy();

            if (this.type === 'PUMPKIN') {
                this.spawnPumpkinExplosion(this.position.x, this.position.y);
                const splashRadiusSq = 48400; // 220 squared
                for (let i = 0; i < enemies.length; i++) {
                    const enemy = enemies[i];
                    const dx = (enemy.position.x + enemy.width / 2) - this.position.x;
                    const dy = (enemy.position.y + enemy.height / 2) - this.position.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= splashRadiusSq) {
                        this.applyDamageToEnemy(enemy, pumpkinSplashDamage);
                    }
                }
            } else {
                this.applyDamageToEnemy(hitEnemy, DAMAGE_DEALT);
            }

        } else {
            // Boss/zombie projectiles - target player
            if (!this._cachedPlayers) {
                this._cachedPlayers = this.gameEnv.gameObjects.filter(obj => 
                    obj.constructor.name === 'Player' || obj.constructor.name === 'FightingPlayer'
                );
            }
            const players = this._cachedPlayers;
            if (players.length === 0) return null;

            // Find closest player
            let nearest = players[0];
            let minDistSq = Infinity;

            for (let i = 0; i < players.length; i++) {
                const player = players[i];
                const dx = player.position.x - this.position.x;
                const dy = player.position.y - this.position.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearest = player;
                }
            }

            // Distance in squared form to avoid sqrt
            const PLAYER_HIT_DISTANCE_SQ = 2500; // 50 squared
            if (minDistSq <= PLAYER_HIT_DISTANCE_SQ) {
                this.revComplete = true;
                this.destroy();
                if (nearest && typeof nearest.isShieldActive === 'function' && nearest.isShieldActive()) {
                    return;
                }
                if (!nearest.data) nearest.data = { health: 100, maxHealth: 100 };
                nearest.data.health -= DAMAGE_DEALT;
                spawnPlayerDamageEffect(this.gameEnv, nearest);
                if (nearest.data.health <= 0) {
                    // Show death screen
                    showDeathScreen(nearest);
                }
            }

            // Update the player health bar to accurately show the new health (if available)
            try {
                if (nearest && nearest.data && typeof updatePlayerHealthBar === 'function') {
                    const maxHealth = nearest.data.maxHealth || 100;
                    const pct = Math.max(0, Math.min(100, (nearest.data.health / maxHealth) * 100));
                    updatePlayerHealthBar(pct);
                }
            } catch (e) {
                console.warn('Failed to update player health bar:', e);
            }
        }
    }

    applyDamageToEnemy(enemy, amount) {
        if (enemy.constructor.name === 'Boss') {
            enemy.healthPoints -= amount;
            console.log("Reaper Health:", enemy.healthPoints);
            return;
        }

        if (enemy.constructor.name === 'Zombie') {
            if (typeof enemy.takeDamage === 'function') {
                enemy.takeDamage(amount);
            } else if (typeof enemy.healthPoints === 'number') {
                enemy.healthPoints -= amount;
                if (enemy.healthPoints <= 0 && enemy.destroy) enemy.destroy();
            }
        }
    }

    spawnPumpkinExplosion(x, y) {
        if (!this.gameEnv || !this.gameEnv.container) return;

        const burst = document.createElement('div');
        Object.assign(burst.style, {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'rgba(255, 140, 0, 0.9)',
            boxShadow: '0 0 30px 15px rgba(255, 140, 0, 0.7), 0 0 60px 25px rgba(255, 80, 0, 0.5)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: '200'
        });

        this.gameEnv.container.appendChild(burst);
        burst.animate(
            [
                { transform: 'translate(-50%, -50%) scale(0.7)', opacity: 1 },
                { transform: 'translate(-50%, -50%) scale(2.2)', opacity: 0 }
            ],
            { duration: 420, easing: 'ease-out', fill: 'forwards' }
        );

        setTimeout(() => burst.remove(), 460);
    }

    // Function to execute death
    die() {
        // Find all player objects
        const players = this.gameEnv.gameObjects.filter(obj =>
            obj.constructor.name === 'Player'
        );

        if (players.length === 0) return;

        // Find nearest player
        let nearest = players[0];
        let minDist = Infinity;

        for (const player of players) {
            const dx = player.position.x - this.position.x;
            const dy = player.position.y - this.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
                minDist = dist;
                nearest = player;
            }
        }

        let player = nearest;
        showDeathScreen(player);
    }

    // Carry over the method that is destroying the image once it's offscreen
    destroy() {
        super.destroy();
    }
}

export default Projectile;
