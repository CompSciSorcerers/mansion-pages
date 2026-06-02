import Player from '@assets/js/GameEnginev1.1/essentials/Player.js';
import Projectile from './Projectile.js';
import PlayerScythe from './PlayerScythe.js';
import { updatePlayerHealthBar } from './HealthBars.js';

/* -------------------- CONSTANTS -------------------- */

const POWER_UP_DURATION_MS = {
    shield: 8000,
    damageBoost: 10000,
    scythes: 12000
};

const POWER_UP_LABELS = {
    shield: 'Shield',
    charge: 'Shockwave charged',
    damageBoost: 'Damage boost',
    scythes: 'Scythes',
    heal: 'Healed +10%'
};

const CONTROLS = {
    arrow: 'KeyJ',
    pumpkin: 'KeyK',
    shockwave: 'KeyL'
};

const DIRECTION_VECTORS = new Map([
    ['up', { x: 0, y: -1 }],
    ['down', { x: 0, y: 1 }],
    ['left', { x: -1, y: 0 }],
    ['right', { x: 1, y: 0 }]
]);

/* -------------------- CLASS -------------------- */

class FightingPlayer extends Player {
    constructor(data = null, gameEnv = null) {
        super(data, gameEnv);

        this.projectiles = [];
        this.orbitingScythes = [];

        this.lastAttackTime = Date.now();
        this.lastPumpkinTime = Date.now();
        this.lastShockwaveTime = Date.now();

        this.attackCooldown = 500;
        this.pumpkinCooldown = 900;
        this.shockwaveCooldown = 30000;

        this.shockwaveBossDamage = 20;
        this.baseDamageMultiplier = 1;

        this.currentDirection = 'right';

        this.shieldUntil = 0;
        this.damageBoostUntil = 0;

        this._bindControls();
        this.ensureShockwaveUI();
    }

    /* -------------------- CORE UPDATE -------------------- */

    update(...args) {
        super.update(...args);

        this.updateDirection();
        this.updatePowerUpEffects();
        this.updateShockwaveUI();

        this.projectiles = this.projectiles.filter(p => !p.revComplete);
        this.projectiles.forEach(p => p.update());

        this.orbitingScythes = this.orbitingScythes.filter(s => !s.revComplete);
    }

    /* -------------------- HELPERS -------------------- */

    getCenter() {
        return {
            x: this.position.x + this.width / 2,
            y: this.position.y + this.height / 2
        };
    }

    getEnemies() {
        return this.gameEnv.gameObjects.filter(obj =>
            obj.constructor.name === 'Boss' || obj.constructor.name === 'Zombie'
        );
    }

    spawnProjectile(type, targetX, targetY) {
        const { x: sourceX, y: sourceY } = this.getCenter();

        this.projectiles.push(
            new Projectile(
                this.gameEnv,
                targetX,
                targetY,
                sourceX,
                sourceY,
                type,
                { owner: this }
            )
        );
    }

    /* -------------------- INPUT -------------------- */

    _bindControls() {
        if (typeof window === 'undefined') return;

        this._attackHandler = (event) => {
            if (this.isArrowKey(event)) {
                event.preventDefault();
                this.attackArrow();
            }

            if (this.isPumpkinKey(event)) {
                event.preventDefault();
                this.attackPumpkin();
            }

            if (this.isShockwaveKey(event)) {
                event.preventDefault();
                this.triggerShockwave();
            }
        };

        window.addEventListener('keydown', this._attackHandler);
    }

    isArrowKey(e) {
        return e.code === CONTROLS.arrow || e.key?.toLowerCase() === 'j';
    }

    isPumpkinKey(e) {
        return e.code === CONTROLS.pumpkin || e.key?.toLowerCase() === 'k';
    }

    isShockwaveKey(e) {
        return e.code === CONTROLS.shockwave || e.key?.toLowerCase() === 'l';
    }

    /* -------------------- ATTACKS -------------------- */

    attackArrow() {
        const now = Date.now();
        if (now - this.lastAttackTime < this.attackCooldown) return;

        const { x: sourceX, y: sourceY } = this.getCenter();
        const target = this.getNearestEnemyTarget();

        const { targetX, targetY } = this.resolveTarget(target, 500);

        this.spawnProjectile('PLAYER', targetX, targetY);
        this.lastAttackTime = now;
    }

    attackPumpkin() {
        const now = Date.now();
        if (now - this.lastPumpkinTime < this.pumpkinCooldown) return;

        const { x: sourceX, y: sourceY } = this.getCenter();
        const target = this.getNearestEnemyTarget();

        const { targetX, targetY } = this.resolveTarget(target, 420);

        this.spawnProjectile('PUMPKIN', targetX, targetY);
        this.lastPumpkinTime = now;
    }

    resolveTarget(target, fallbackDist) {
        const { x: sourceX, y: sourceY } = this.getCenter();

        if (target) {
            return {
                targetX: target.x,
                targetY: target.y
            };
        }

        const v = this.getAttackVector();
        return {
            targetX: sourceX + v.x * fallbackDist,
            targetY: sourceY + v.y * fallbackDist
        };
    }

    /* -------------------- DIRECTION -------------------- */

    updateDirection() {
        if (this.velocity.x === 0 && this.velocity.y === 0) return;

        const ax = Math.abs(this.velocity.x);
        const ay = Math.abs(this.velocity.y);

        if (ax >= ay) {
            this.currentDirection = this.velocity.x >= 0 ? 'right' : 'left';
        } else {
            this.currentDirection = this.velocity.y >= 0 ? 'down' : 'up';
        }
    }

    getAttackVector() {
        return DIRECTION_VECTORS.get(this.currentDirection)
            || DIRECTION_VECTORS.get('right');
    }

    /* -------------------- ENEMIES -------------------- */

    getNearestEnemyTarget() {
        const enemies = this.getEnemies();
        if (!enemies.length) return null;

        const { x: sx, y: sy } = this.getCenter();

        let nearestBoss = null;
        let nearestZombie = null;
        let bossDist = Infinity;
        let zombieDist = Infinity;

        for (const e of enemies) {
            const ex = e.position.x + e.width / 2;
            const ey = e.position.y + e.height / 2;

            const dist = Math.hypot(ex - sx, ey - sy);

            if (e.constructor.name === 'Boss') {
                if (dist < bossDist) {
                    bossDist = dist;
                    nearestBoss = e;
                }
            } else {
                if (dist < zombieDist) {
                    zombieDist = dist;
                    nearestZombie = e;
                }
            }
        }

        const chosen =
            nearestBoss && nearestZombie
                ? (bossDist * 0.7 <= zombieDist ? nearestBoss : nearestZombie)
                : nearestBoss || nearestZombie;

        return {
            x: chosen.position.x + chosen.width / 2,
            y: chosen.position.y + chosen.height / 2
        };
    }

    /* -------------------- SHOCKWAVE -------------------- */

    triggerShockwave() {
        if (!this.isShockwaveReady()) return;

        const enemies = this.getEnemies();

        enemies.forEach(e => {
            if (e.constructor.name === 'Zombie') {
                e.takeDamage?.(9999) || e.destroy?.();
            }
        });

        const boss = enemies.find(e => e.constructor.name === 'Boss');
        if (boss) {
            boss.healthPoints -= Math.round(
                this.shockwaveBossDamage * this.getDamageMultiplier()
            );
        }

        this.clearActiveProjectiles();
        this.spawnShockwaveEffect();

        this.lastShockwaveTime = Date.now();
        this.updateShockwaveUI(true);
    }

    isShockwaveReady() {
        return Date.now() - this.lastShockwaveTime >= this.shockwaveCooldown;
    }

    /* -------------------- POWERUPS -------------------- */

    applyPowerUp(type) {
        const now = Date.now();

        switch (type) {
            case 'shield':
                this.shieldUntil = Math.max(this.shieldUntil, now) + POWER_UP_DURATION_MS.shield;
                break;

            case 'charge':
                this.chargeShockwave();
                break;

            case 'damageBoost':
                this.damageBoostUntil = Math.max(this.damageBoostUntil, now) + POWER_UP_DURATION_MS.damageBoost;
                break;

            case 'scythes':
                this.activateScythes();
                break;

            case 'heal': {
                const max = this.data?.maxHealth ?? 100;
                const curr = this.data?.health ?? max;
                const healed = Math.min(max, curr + max * 0.1);
                this.data.health = healed;

                updatePlayerHealthBar?.((healed / max) * 100);
                break;
            }
        }

        this.showPowerUpMessage(type);
    }

    isShieldActive() {
        return Date.now() < this.shieldUntil;
    }

    getDamageMultiplier() {
        return Date.now() < this.damageBoostUntil ? 2 : this.baseDamageMultiplier;
    }

    chargeShockwave() {
        this.lastShockwaveTime = Date.now() - this.shockwaveCooldown;
        this.updateShockwaveUI(true);
    }

    activateScythes() {
        this.orbitingScythes.forEach(s => {
            s.revComplete = true;
            s.destroy?.();
        });

        this.orbitingScythes = [];

        for (let i = 0; i < 2; i++) {
            const scythe = new PlayerScythe(this.gameEnv, this, {
                angle: (Math.PI * 2 / 2) * i,
                durationMs: POWER_UP_DURATION_MS.scythes
            });

            this.orbitingScythes.push(scythe);
            this.gameEnv.gameObjects.push(scythe);
        }
    }

    updatePowerUpEffects() {
        const shield = this.isShieldActive();
        const boost = Date.now() < this.damageBoostUntil;

        this.data.canvasFilter =
            shield ? 'drop-shadow(0 0 12px #4CC9F0)'
            : boost ? 'drop-shadow(0 0 12px #EF476F)'
            : 'none';
    }

    /* -------------------- PROJECTILES CLEANUP -------------------- */

    clearActiveProjectiles() {
        const bosses = this.gameEnv.gameObjects.filter(o => o.constructor.name === 'Boss');

        bosses.forEach(b => {
            ['fireballs', 'arrows', 'scythes'].forEach(key => {
                if (Array.isArray(b[key])) {
                    b[key].forEach(p => {
                        p.revComplete = true;
                        p.destroy?.();
                    });
                    b[key] = [];
                }
            });
        });

        this.gameEnv.gameObjects = this.gameEnv.gameObjects.filter(obj => {
            const isEnemyShot =
                (obj.constructor.name === 'Projectile' || obj.constructor.name === 'Boomerang') &&
                obj.type !== 'PLAYER' &&
                obj.type !== 'PUMPKIN';

            if (isEnemyShot) {
                obj.destroy?.();
                return false;
            }

            return true;
        });
    }

    /* -------------------- UI -------------------- */

    showPowerUpMessage(type) {
        if (typeof document === 'undefined' || !this.gameEnv?.container) return;

        let msg = document.getElementById('power-up-message');

        if (!msg) {
            msg = document.createElement('div');
            msg.id = 'power-up-message';

            Object.assign(msg.style, {
                position: 'absolute',
                left: '50%',
                bottom: '112px',
                transform: 'translateX(-50%)',
                color: '#fff',
                fontFamily: "'Press Start 2P', sans-serif",
                fontSize: '14px',
                textShadow: '2px 2px 4px rgba(0,0,0,0.75)',
                pointerEvents: 'none',
                zIndex: '250',
                transition: 'opacity 0.25s ease'
            });

            this.gameEnv.container.appendChild(msg);
        }

        msg.textContent = POWER_UP_LABELS[type] || 'Power up';
        msg.style.opacity = '1';

        clearTimeout(this._powerUpTimer);
        this._powerUpTimer = setTimeout(() => {
            msg.style.opacity = '0';
        }, 1400);
    }

    /* -------------------- SHOCKWAVE UI (UNCHANGED LOGIC) -------------------- */

    ensureShockwaveUI() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('shockwave-container')) return;

        const container = document.createElement('div');
        container.id = 'shockwave-container';

        Object.assign(container.style, {
            position: 'absolute',
            bottom: '32px',
            right: '0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            width: '50%',
            padding: '0 24px',
            boxSizing: 'border-box',
            zIndex: '100'
        });

        const label = document.createElement('div');
        label.id = 'shockwave-label';
        label.textContent = 'SHOCKWAVE';

        const bar = document.createElement('div');
        bar.id = 'shockwave-bar';

        const fill = document.createElement('div');
        fill.id = 'shockwave-fill';

        bar.appendChild(fill);
        container.appendChild(label);
        container.appendChild(bar);

        const root = document.querySelector('canvas')?.parentElement || document.body;
        root.appendChild(container);

        if (!document.getElementById('shockwave-style')) {
            const style = document.createElement('style');
            style.id = 'shockwave-style';
            style.textContent = `@keyframes shockwave-ready-pulse{0%{filter:brightness(1)}50%{filter:brightness(1.4)}100%{filter:brightness(1)}}`;
            document.head.appendChild(style);
        }
    }

    updateShockwaveUI(force = false) {
        const c = document.getElementById('shockwave-container');
        const fill = document.getElementById('shockwave-fill');
        const label = document.getElementById('shockwave-label');
        if (!c || !fill) return;

        const pct = Math.min(1, (Date.now() - this.lastShockwaveTime) / this.shockwaveCooldown);

        fill.style.width = `${pct * 100}%`;

        if (pct >= 1) {
            c.classList.add('shockwave-ready');
            if (label) label.textContent = 'SHOCKWAVE - READY';
        } else {
            c.classList.remove('shockwave-ready');
            if (label) label.textContent = 'SHOCKWAVE';
        }
    }

    spawnShockwaveEffect() {
        if (!this.gameEnv?.container) return;

        const el = document.createElement('div');

        Object.assign(el.style, {
            position: 'absolute',
            inset: '0',
            background: 'radial-gradient(circle, rgba(255,245,220,0.95) 0%, rgba(255,120,30,0.6) 70%, transparent 100%)',
            zIndex: '200',
            pointerEvents: 'none'
        });

        this.gameEnv.container.appendChild(el);

        el.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 520,
            easing: 'ease-out',
            fill: 'forwards'
        });

        setTimeout(() => el.remove(), 560);
        this.shakeScreen();
    }

    shakeScreen() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;

        let shakes = 0;
        const max = 6;

        const interval = setInterval(() => {
            canvas.style.transform = `translate(${(Math.random() - 0.5) * 6}px, ${(Math.random() - 0.5) * 6}px)`;
            if (++shakes >= max) {
                clearInterval(interval);
                canvas.style.transform = '';
            }
        }, 50);
    }

    destroy() {
        if (typeof window !== 'undefined' && this._attackHandler) {
            window.removeEventListener('keydown', this._attackHandler);
        }

        clearTimeout(this._powerUpTimer);

        this.orbitingScythes.forEach(s => {
            s.revComplete = true;
            s.destroy?.();
        });

        super.destroy();
    }
}

export default FightingPlayer;