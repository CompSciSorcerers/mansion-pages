import Barrier from './Barrier.js';
import showDeathScreen from './DeathScreen.js';

class MansionDeathBarrier extends Barrier {
    constructor(data, gameEnv) {
        super(data, gameEnv);
        // Load the lava image and scale it to the barrier bounds when drawing
        this.lavaImage = new Image(720, 720);
        const assetPath = (gameEnv && gameEnv.path) ? gameEnv.path + '/images/projects/mansionGame' : '/images/projects/mansionGame';
        this.lavaImage.src = `${assetPath}/Lava.jpg`;
        this.lavaImage.onerror = () => {
            console.warn('[MansionDeathBarrier] Failed to load lava image:', this.lavaImage.src);
        };
        this._hasTriggeredDeath = false;
    }

    /**
     * Draw the lava image scaled to barrier bounds
     */
    draw() {
        if (!this.gameEnv?.ctx || !this.visible) return;

        const ctx = this.gameEnv.ctx;
        const canvasLeft = this.gameEnv?.left || 0;
        const canvasTop = this.gameEnv?.top || 0;

        // Only draw if image loaded successfully
        if (this.lavaImage && this.lavaImage.naturalWidth > 0 && this.lavaImage.naturalHeight > 0) {
            ctx.drawImage(
                this.lavaImage,
                this.x + canvasLeft,
                this.y + canvasTop,
                this.width,
                this.height
            );
        }

        // Animated border/glow to match previous styling
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
        // Draw each frame
        if (this.gameEnv?.ctx) this.draw();

        if (this._hasTriggeredDeath) return;

        // Find player
        const player = this.gameEnv?.gameObjects?.find(obj => 
            obj?.constructor?.name === 'FightingPlayer' || obj?.constructor?.name === 'Player'
        );
        if (!player) return;

        if (this.checkCollision(player)) {
            this._hasTriggeredDeath = true;
            player.isDead = true;
            console.log('[MansionGame] Lava barrier hit player');
            try {
                showDeathScreen(player);
            } catch (error) {
                console.error('Lava barrier failed to show death screen:', error);
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
        // No resize-specific work needed; image is drawn to barrier bounds.
    }

    destroy() {
        // Clean up image reference
        this.lavaImage = null;
    }
}

export default MansionDeathBarrier;
