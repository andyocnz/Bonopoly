import React, { useEffect, useRef } from 'react'

interface FireworksProps {
    isActive: boolean
}

export const Fireworks: React.FC<FireworksProps> = ({ isActive }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (!isActive) return

        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let width = canvas.width = canvas.offsetWidth
        let height = canvas.height = canvas.offsetHeight

        const resizeObserver = new ResizeObserver(() => {
            if (canvas) {
                width = canvas.width = canvas.offsetWidth
                height = canvas.height = canvas.offsetHeight
            }
        })
        resizeObserver.observe(canvas)

        // Particle System
        class Particle {
            x: number
            y: number
            vx: number
            vy: number
            alpha: number
            color: string
            decay: number

            constructor(x: number, y: number, color: string) {
                this.x = x
                this.y = y
                // Explosion velocity
                const angle = Math.random() * Math.PI * 2
                const speed = Math.random() * 4 + 2
                this.vx = Math.cos(angle) * speed
                this.vy = Math.sin(angle) * speed
                this.alpha = 1
                this.color = color
                this.decay = Math.random() * 0.015 + 0.015
            }

            update() {
                this.vx *= 0.95 // Air resistance
                this.vy *= 0.95
                this.vy += 0.1 // Gravity
                this.x += this.vx
                this.y += this.vy
                this.alpha -= this.decay
            }

            draw(ctx: CanvasRenderingContext2D) {
                ctx.save()
                ctx.globalAlpha = this.alpha
                ctx.fillStyle = this.color
                ctx.beginPath()
                ctx.arc(this.x, this.y, 2, 0, Math.PI * 2)
                ctx.fill()
                ctx.restore()
            }
        }

        class Rocket {
            x: number
            y: number
            vx: number
            vy: number
            color: string
            exploded: boolean

            constructor() {
                this.x = Math.random() * width
                this.y = height
                this.vx = (Math.random() - 0.5) * 4
                this.vy = -(Math.random() * 5 + 10) // Launch speed
                this.color = `hsl(${Math.random() * 360}, 70%, 50%)`
                this.exploded = false
            }

            update() {
                this.x += this.vx
                this.y += this.vy
                this.vy += 0.15 // Gravity slows rocket
            }

            draw(ctx: CanvasRenderingContext2D) {
                ctx.fillStyle = this.color
                ctx.fillRect(this.x, this.y, 3, 3)
            }
        }

        const particles: Particle[] = []
        const rockets: Rocket[] = []
        let animationFrameId: number

        const loop = () => {
            ctx.globalCompositeOperation = 'destination-out'
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)' // Create trails
            ctx.fillRect(0, 0, width, height)
            ctx.globalCompositeOperation = 'lighter'

            // Spawn rockets occasionally
            if (Math.random() < 0.05) {
                rockets.push(new Rocket())
            }

            // Update Rockets
            for (let i = rockets.length - 1; i >= 0; i--) {
                const r = rockets[i]
                r.update()
                r.draw(ctx)

                // Explode logic (when vertical speed is near zero/peak)
                if (r.vy >= -1 && !r.exploded) {
                    r.exploded = true
                    // Create explosion
                    for (let j = 0; j < 50; j++) {
                        particles.push(new Particle(r.x, r.y, r.color))
                    }
                    rockets.splice(i, 1)
                }
                // Remove if off screen
                else if (r.y > height + 50 || r.x < -50 || r.x > width + 50) {
                    rockets.splice(i, 1)
                }
            }

            // Update Particles
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i]
                p.update()
                p.draw(ctx)
                if (p.alpha <= 0) {
                    particles.splice(i, 1)
                }
            }

            animationFrameId = requestAnimationFrame(loop)
        }

        loop()

        return () => {
            cancelAnimationFrame(animationFrameId)
            resizeObserver.disconnect()
        }
    }, [isActive])

    if (!isActive) return null

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 10
            }}
        />
    )
}
