import Barrier from './Barrier.js';
import showDeathScreen from './DeathScreen.js';

class MansionDeathBarrier extends Barrier {
    constructor(data, gameEnv) {
        super(data, gameEnv);
        this.pixelSize = data?.pixelSize || 8; // Size of each pixel block
        this.colors = [
            'rgb(255, 0, 0)',      // Red
            'rgb(255, 85, 0)',     // Orange-Red
            'rgb(255, 170, 0)',    // Orange
            'rgb(255, 200, 85)',   // Light Orange
            'rgb(255, 255, 0)',    // Yellow
            'rgb(255, 200, 0)'     // Gold
        ];
        this.noise = this.generateNoise();
    }

    /**
     * Generate a noise pattern for the pixelated effect
     */
    generateNoise() {
        const cols = Math.ceil(this.width / this.pixelSize);
        const rows = Math.ceil(this.height / this.pixelSize);
        const noise = [];
        
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                noise.push(Math.random());
            }
        }
        return noise;
    }

    /**
     * Get the color value based on noise/heat intensity
     */
    getColorForNoise(noiseValue) {
        const index = Math.floor(noiseValue * (this.colors.length - 1));
        return this.colors[Math.max(0, Math.min(index, this.colors.length - 1))];
    }

    /**
     * Override draw to render pixelated effect
     */
    draw() {
        if (!this.gameEnv?.ctx || !this.visible) return;

        const ctx = this.gameEnv.ctx;
        const canvasLeft = this.gameEnv?.left || 0;
        const canvasTop = this.gameEnv?.top || 0;

        const cols = Math.ceil(this.width / this.pixelSize);
        const rows = Math.ceil(this.height / this.pixelSize);

        // Draw pixelated heat map
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const noiseIndex = y * cols + x;
                const noiseValue = this.noise[noiseIndex] || Math.random();
                
                ctx.fillStyle = this.getColorForNoise(noiseValue);
                ctx.fillRect(
                    this.x + x * this.pixelSize + canvasLeft,
                    this.y + y * this.pixelSize + canvasTop,
                    this.pixelSize,
                    this.pixelSize
                );
            }
        }

        // Draw animated border/glow effect
        const glowIntensity = (Math.sin(Date.now() / 200) + 1) / 2; // Pulsing glow
        ctx.strokeStyle = `rgba(255, 200, 0, ${0.3 + glowIntensity * 0.5})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(
            this.x + canvasLeft,
            this.y + canvasTop,
            this.width,
            this.height
        );
    }

    update() {
        // Call draw to render the lava barrier
        if (this.gameEnv?.ctx) {
            this.draw();
        }

        if (this._hasTriggeredDeath) return;

        // Find FightingPlayer in the mansion game
        const player = this.gameEnv?.gameObjects?.find(obj => 
            obj?.constructor?.name === 'FightingPlayer' || obj?.constructor?.name === 'Player'
        );
        
        if (!player) return;

        // Check collision using AABB method
        if (this.checkCollision(player)) {
            this._hasTriggeredDeath = true;
            player.isDead = true;

            console.log('[MansionGame] Lava barrier hit player');

            // Trigger death
            try {
                showDeathScreen(player);
            } catch (error) {
                console.error('Lava barrier failed to show death screen:', error);
                // Fallback - directly set health to 0
                if (player.data) player.data.health = 0;
                if (player.healthPoints !== undefined) player.healthPoints = 0;
            }
        }
    }

    /**
     * AABB collision detection
     */
    checkCollision(player) {
        if (!player || !player.position || !player.width || !player.height) {
            return false;
        }
        
        // Calculate player hitbox
        const hitboxWidthPercent = (player.hitbox && player.hitbox.widthPercentage) || 1;
        const hitboxHeightPercent = (player.hitbox && player.hitbox.heightPercentage) || 1;
        const hitboxWidth = player.width * hitboxWidthPercent;
        const hitboxHeight = player.height * hitboxHeightPercent;
        const hitboxX = player.position.x + (player.width - hitboxWidth) / 2;
        const hitboxY = player.position.y + (player.height - hitboxHeight);
        
        // AABB collision
        return !(
            hitboxX > this.x + this.width ||
            hitboxX + hitboxWidth < this.x ||
            hitboxY > this.y + this.height ||
            hitboxY + hitboxHeight < this.y
        );
    }

    resize() {
        // Regenerate noise if resized
        this.noise = this.generateNoise();
    }

    destroy() {
        // Clean up
        this.noise = [];
    }
}

export default MansionDeathBarrier;
