import './style.css'
import {
  AbstractMesh,
  AnimationGroup,
  Color3,
  Color4,
  DirectionalLight,
  DynamicTexture,
  Engine,
  FreeCamera,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  Scene,
  SceneLoader,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders/glTF'

type Cat = {
  root: TransformNode
  hitbox: Mesh
  meshes: AbstractMesh[]
  label: Mesh
  animationGroups: AnimationGroup[]
  activeAnimation: string
  activity: CatActivity
  nextActivityAt: number
  infected: boolean
  alive: boolean
  speed: number
  target: Vector3
}

type CatActivity = 'Walk' | 'Idle' | 'Idle_Eating'

type Bullet = {
  mesh: Mesh
  velocity: Vector3
  life: number
}

const WORLD_SIZE = 38
const WALL_HEIGHT = 4
const CAT_COUNT = 9
const CAT_MODEL_SCALE = 0.82
const BULLET_SPEED = 0.82
const BULLET_LIFE = 1100
const INFECTION_TOUCH_DISTANCE = 1.15
const SHOT_COOLDOWN = 420
const SHOTGUN_REST_Z = 1.45
const SHOTGUN_RECOIL_Z = 1.18
const SHOTGUN_REST_ROTATION = new Vector3(0.05, -Math.PI / 2, -0.08)
const PLAY_LIMIT = WORLD_SIZE / 2 - 1.4
const MODEL_ROOT = '/world_media/Assets/gltf/'
const MIN_ACTIVITY_TIME = 7000
const MAX_ACTIVITY_TIME = 10000
const CAT_ACTIVITY_WEIGHTS = [
  { name: 'Walk', weight: 0.7 },
  { name: 'Idle_Eating', weight: 0.2 },
  { name: 'Idle', weight: 0.1 },
] as const satisfies readonly { name: CatActivity; weight: number }[]
const TREE_ASSETS = [
  'Tree_1_A_Color1.gltf',
  'Tree_1_B_Color1.gltf',
  'Tree_1_C_Color1.gltf',
  'Tree_2_A_Color1.gltf',
  'Tree_2_B_Color1.gltf',
  'Tree_2_C_Color1.gltf',
  'Tree_2_D_Color1.gltf',
  'Tree_2_E_Color1.gltf',
  'Tree_3_A_Color1.gltf',
  'Tree_3_B_Color1.gltf',
  'Tree_3_C_Color1.gltf',
  'Tree_4_A_Color1.gltf',
  'Tree_4_B_Color1.gltf',
  'Tree_4_C_Color1.gltf',
  'Tree_Bare_1_A_Color1.gltf',
  'Tree_Bare_1_B_Color1.gltf',
  'Tree_Bare_1_C_Color1.gltf',
  'Tree_Bare_2_A_Color1.gltf',
  'Tree_Bare_2_B_Color1.gltf',
  'Tree_Bare_2_C_Color1.gltf',
]
const BUSH_ASSETS = [
  'Bush_1_A_Color1.gltf',
  'Bush_1_B_Color1.gltf',
  'Bush_1_C_Color1.gltf',
  'Bush_1_D_Color1.gltf',
  'Bush_1_E_Color1.gltf',
  'Bush_1_F_Color1.gltf',
  'Bush_1_G_Color1.gltf',
  'Bush_2_A_Color1.gltf',
  'Bush_2_B_Color1.gltf',
  'Bush_2_C_Color1.gltf',
  'Bush_2_D_Color1.gltf',
  'Bush_2_E_Color1.gltf',
  'Bush_2_F_Color1.gltf',
  'Bush_3_A_Color1.gltf',
  'Bush_3_B_Color1.gltf',
  'Bush_3_C_Color1.gltf',
  'Bush_4_A_Color1.gltf',
  'Bush_4_B_Color1.gltf',
  'Bush_4_C_Color1.gltf',
  'Bush_4_D_Color1.gltf',
  'Bush_4_E_Color1.gltf',
  'Bush_4_F_Color1.gltf',
]
const GRASS_ASSETS = [
  'Grass_1_A_Color1.gltf',
  'Grass_1_B_Color1.gltf',
  'Grass_1_C_Color1.gltf',
  'Grass_1_D_Color1.gltf',
  'Grass_1_A_Singlesided_Color1.gltf',
  'Grass_1_B_Singlesided_Color1.gltf',
  'Grass_1_C_Singlesided_Color1.gltf',
  'Grass_1_D_Singlesided_Color1.gltf',
  'Grass_1_Mesh.gltf',
  'Grass_1_SingleSided_Mesh.gltf',
  'Grass_2_A_Color1.gltf',
  'Grass_2_B_Color1.gltf',
  'Grass_2_C_Color1.gltf',
  'Grass_2_D_Color1.gltf',
  'Grass_2_A_Singlesided_Color1.gltf',
  'Grass_2_B_Singlesided_Color1.gltf',
  'Grass_2_C_Singlesided_Color1.gltf',
  'Grass_2_D_Singlesided_Color1.gltf',
  'Grass_2_Mesh.gltf',
  'Grass_2_SingleSided_Mesh.gltf',
]
const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Missing #app root')
}
const rootApp = app

createKittyGame()

function createKittyGame() {
rootApp.innerHTML = `
  <canvas id="game-canvas"></canvas>
  <div class="hud">
    <div>
      <p class="eyebrow">Kitty Killer</p>
      <h1>Find the infected cat</h1>
    </div>
    <div class="stats">
      <span id="kitty-count">Kitties: 0</span>
      <span id="status">Click to enter FOV</span>
    </div>
  </div>
  <div class="reticle" aria-hidden="true"></div>
  <div class="controls">
    <span>WASD move</span>
    <span>Mouse look</span>
    <span>Click shoot</span>
  </div>
  <button id="restart" type="button" hidden>Restart</button>
`

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!
const kittyCount = document.querySelector<HTMLSpanElement>('#kitty-count')!
const statusText = document.querySelector<HTMLSpanElement>('#status')!
const restartButton = document.querySelector<HTMLButtonElement>('#restart')!

const engine = new Engine(canvas, true)
const scene = new Scene(engine)
scene.clearColor = new Color4(0.74, 0.88, 0.96, 1)

const camera = new FreeCamera('player', new Vector3(0, 1.7, -8), scene)
camera.attachControl(canvas, true)
camera.speed = 0.13
camera.angularSensibility = 4200
camera.minZ = 0.05
camera.keysUp.push(87)
camera.keysDown.push(83)
camera.keysLeft.push(65)
camera.keysRight.push(68)

const skyLight = new HemisphericLight('sky-light', new Vector3(0.2, 1, 0.2), scene)
skyLight.intensity = 1.25
skyLight.groundColor = new Color3(0.56, 0.68, 0.42)
const keyLight = new DirectionalLight('key-light', new Vector3(-0.55, -1, 0.45), scene)
keyLight.position = new Vector3(18, 28, -14)
keyLight.intensity = 1.45
const shadowGenerator = new ShadowGenerator(2048, keyLight)
shadowGenerator.useBlurExponentialShadowMap = true
shadowGenerator.blurKernel = 18

const materials = {
  ground: groundMaterial(),
  grass: material('grass', new Color3(0.42, 0.78, 0.28)),
  water: material('water', new Color3(0.45, 0.76, 0.9)),
  wall: material('wall', new Color3(0.62, 0.68, 0.52)),
  trunk: material('trunk', new Color3(0.5, 0.32, 0.16)),
  leaves: material('leaves', new Color3(0.26, 0.67, 0.2)),
  player: material('player', new Color3(0.9, 0.85, 0.6)),
  cat: material('cat', new Color3(0.92, 0.72, 0.45)),
  dead: material('dead', new Color3(0.16, 0.16, 0.16)),
  marker: material('marker', new Color3(0.95, 0.95, 0.82)),
  bullet: material('bullet', new Color3(1, 0.84, 0.35)),
}

const muzzleFlashMaterial = material('muzzle-flash', new Color3(1, 0.56, 0.12))
muzzleFlashMaterial.emissiveColor = new Color3(1, 0.42, 0.08)

const muzzleFlash = MeshBuilder.CreateSphere('muzzle-flash', { diameter: 0.28, segments: 12 }, scene)
muzzleFlash.parent = camera
muzzleFlash.position = new Vector3(0.08, -0.31, 1.12)
muzzleFlash.scaling = new Vector3(0, 0, 0)
muzzleFlash.material = muzzleFlashMaterial
muzzleFlash.isVisible = false
muzzleFlash.isPickable = false

const sparkTexture = createSparkTexture()
let muzzleFlashLife = 0

function material(name: string, diffuse: Color3) {
  const mat = new StandardMaterial(name, scene)
  mat.diffuseColor = diffuse
  mat.specularColor = new Color3(0.12, 0.12, 0.1)
  return mat
}

function createSparkTexture() {
  const texture = new DynamicTexture('spark-texture', { width: 64, height: 64 }, scene, false)
  const context = texture.getContext()
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 30)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.25, 'rgba(255, 208, 76, 0.9)')
  gradient.addColorStop(1, 'rgba(255, 116, 28, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  texture.update()
  return texture
}

function groundMaterial() {
  const mat = material('ground', new Color3(0.74, 0.86, 0.42))
  const texture = new DynamicTexture('ground-texture', { width: 512, height: 512 }, scene, false)
  const context = texture.getContext()

  context.fillStyle = '#a5c957'
  context.fillRect(0, 0, 512, 512)

  for (let i = 0; i < 900; i += 1) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    const length = 5 + Math.random() * 15
    const alpha = 0.12 + Math.random() * 0.18
    context.strokeStyle = Math.random() > 0.18 ? `rgba(67, 119, 39, ${alpha})` : `rgba(176, 155, 75, ${alpha})`
    context.lineWidth = 1 + Math.random() * 1.4
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + (Math.random() - 0.5) * 5, y - length)
    context.stroke()
  }

  for (let i = 0; i < 120; i += 1) {
    context.fillStyle = `rgba(118, 93, 45, ${0.04 + Math.random() * 0.06})`
    context.fillRect(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 18, 3 + Math.random() * 10)
  }

  texture.update()
  texture.wrapU = Texture.WRAP_ADDRESSMODE
  texture.wrapV = Texture.WRAP_ADDRESSMODE
  texture.uScale = 7
  texture.vScale = 7

  mat.diffuseTexture = texture
  mat.diffuseColor = new Color3(0.86, 0.9, 0.5)
  mat.specularColor = new Color3(0.02, 0.03, 0.02)
  return mat
}

const water = MeshBuilder.CreateGround('water', { width: WORLD_SIZE * 3, height: WORLD_SIZE * 3 }, scene)
water.position.y = -0.08
water.material = materials.water

const island = MeshBuilder.CreateCylinder('island', { height: 0.18, diameter: WORLD_SIZE * 1.18, tessellation: 96 }, scene)
island.position.y = -0.09
island.material = materials.ground
island.receiveShadows = true

const yard = MeshBuilder.CreateGround('yard', { width: WORLD_SIZE, height: WORLD_SIZE }, scene)
yard.material = materials.ground
yard.receiveShadows = true

for (const [name, position, size] of [
  ['north-wall', new Vector3(0, WALL_HEIGHT / 2, WORLD_SIZE / 2), new Vector3(WORLD_SIZE, WALL_HEIGHT, 0.65)],
  ['south-wall', new Vector3(0, WALL_HEIGHT / 2, -WORLD_SIZE / 2), new Vector3(WORLD_SIZE, WALL_HEIGHT, 0.65)],
  ['east-wall', new Vector3(WORLD_SIZE / 2, WALL_HEIGHT / 2, 0), new Vector3(0.65, WALL_HEIGHT, WORLD_SIZE)],
  ['west-wall', new Vector3(-WORLD_SIZE / 2, WALL_HEIGHT / 2, 0), new Vector3(0.65, WALL_HEIGHT, WORLD_SIZE)],
] as const) {
  const wall = MeshBuilder.CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene)
  wall.position = position
  wall.visibility = 0
  wall.isPickable = false
}

async function placeWorldMedia() {
  const treeAssets = shuffled(TREE_ASSETS)
  const treeCount = treeAssets.length * 2
  await Promise.all([
    ...Array.from({ length: treeCount }, (_, index) => {
      const asset = treeAssets[(index * 7) % treeAssets.length]
      const angle = ((index + 0.35 * ((index % 3) - 1)) / treeCount) * Math.PI * 2
      const radius = WORLD_SIZE / 2 + 2.05 + (index % 4) * 0.72
      const scale = 1.18 + (index % 5) * 0.08
      return placeModel(asset, new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius), scale, -angle)
    }),
    ...BUSH_ASSETS.map((asset, index) => {
      const side = index % 4
      const offset = -PLAY_LIMIT + ((index * 3.7) % (PLAY_LIMIT * 2))
      const position =
        side === 0
          ? new Vector3(offset, 0, PLAY_LIMIT - 1.1)
          : side === 1
            ? new Vector3(PLAY_LIMIT - 1.1, 0, offset)
            : side === 2
              ? new Vector3(offset, 0, -PLAY_LIMIT + 1.1)
              : new Vector3(-PLAY_LIMIT + 1.1, 0, offset)
      return placeModel(asset, position, 0.95, index * 0.81)
    }),
    ...GRASS_ASSETS.flatMap((asset, assetIndex) =>
      Array.from({ length: 4 }, (_, patchIndex) => {
        const index = assetIndex * 4 + patchIndex
        const position = new Vector3(
          -PLAY_LIMIT + 2 + ((index * 5.1) % (PLAY_LIMIT * 2 - 4)),
          0,
          -PLAY_LIMIT + 2 + ((index * 7.3) % (PLAY_LIMIT * 2 - 4)),
        )
        return placeModel(asset, position, 0.85 + (index % 3) * 0.12, index * 0.57)
      }),
    ),
  ])
}

async function placeModel(fileName: string, position: Vector3, scale: number, rotationY: number) {
  const result = await SceneLoader.ImportMeshAsync('', MODEL_ROOT, fileName, scene)
  const root = result.meshes[0]
  root.position = position
  root.rotation.y = rotationY
  root.scaling = new Vector3(scale, scale, scale)
  for (const mesh of root.getChildMeshes(false)) {
    mesh.receiveShadows = true
    shadowGenerator.addShadowCaster(mesh)
  }
}

function shuffled<T>(items: T[]) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = (index * 7 + 3) % result.length
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

async function attachShotgun() {
  const result = await SceneLoader.ImportMeshAsync('', '/', 'Shotgun.glb', scene)
  const root = result.meshes[0]
  root.parent = camera
  root.position = new Vector3(0.58, -0.62, 1.45)
  root.rotation = SHOTGUN_REST_ROTATION.clone()
  root.scaling = new Vector3(0.48, 0.48, 0.48)
  root.isPickable = false
  for (const mesh of root.getChildMeshes(false)) {
    mesh.isPickable = false
  }
  shotgunRoot = root
}

function showMuzzleEffects(direction: Vector3) {
  muzzleFlashLife = 70
  muzzleFlash.isVisible = true
  muzzleFlash.scaling = new Vector3(2 + Math.random() * 0.6, 0.8 + Math.random() * 0.3, 2 + Math.random() * 0.6)

  const sparks = new ParticleSystem(`muzzle-sparks-${performance.now()}`, 42, scene)
  sparks.particleTexture = sparkTexture
  sparks.emitter = camera.position.add(direction.scale(1.1)).add(new Vector3(0, -0.22, 0))
  sparks.minEmitBox = Vector3.Zero()
  sparks.maxEmitBox = Vector3.Zero()
  sparks.color1 = new Color4(1, 0.82, 0.28, 1)
  sparks.color2 = new Color4(1, 0.42, 0.08, 1)
  sparks.colorDead = new Color4(0.35, 0.18, 0.05, 0)
  sparks.minSize = 0.035
  sparks.maxSize = 0.1
  sparks.minLifeTime = 0.05
  sparks.maxLifeTime = 0.2
  sparks.emitRate = 1200
  sparks.blendMode = ParticleSystem.BLENDMODE_ADD
  sparks.gravity = new Vector3(0, -2.8, 0)
  sparks.direction1 = direction.add(new Vector3(-0.18, -0.08, -0.18)).scale(1.1)
  sparks.direction2 = direction.add(new Vector3(0.18, 0.18, 0.18)).scale(1.65)
  sparks.minAngularSpeed = -8
  sparks.maxAngularSpeed = 8
  sparks.minEmitPower = 0.4
  sparks.maxEmitPower = 1.2
  sparks.updateSpeed = 0.018
  sparks.targetStopDuration = 0.035
  sparks.disposeOnStop = true
  sparks.start()
}

const cats: Cat[] = []
const bullets: Bullet[] = []
let running = true
let lastShot = 0
let shotgunRoot: AbstractMesh | null = null
let catModel:
  | Awaited<ReturnType<typeof SceneLoader.LoadAssetContainerAsync>>
  | null = null

function resetGame() {
  for (const bullet of bullets) {
    bullet.mesh.dispose()
  }
  bullets.length = 0

  for (const cat of cats) {
    cat.root.dispose()
    cat.hitbox.dispose()
    cat.label.dispose()
  }
  cats.length = 0

  const infectedIndex = Math.floor(Math.random() * CAT_COUNT)
  for (let i = 0; i < CAT_COUNT; i += 1) {
    cats.push(createCat(i, i === infectedIndex))
  }

  running = true
  lastShot = 0
  restartButton.hidden = true
  statusText.textContent = 'Find the infected cat'
  updateKittyCount()
}

function createCat(index: number, infected: boolean): Cat {
  const root = new TransformNode(`cat-${index}-root`, scene)
  root.position = randomPoint()

  const hitbox = MeshBuilder.CreateBox(`cat-${index}-hitbox`, { width: 0.95, height: 1.45, depth: 1.35 }, scene)
  hitbox.parent = root
  hitbox.position.y = 0.72
  hitbox.visibility = 0
  hitbox.isPickable = true

  const meshes: AbstractMesh[] = [hitbox]
  const instance = catModel?.instantiateModelsToScene((name) => `cat-${index}-${name}`, false)
  for (const node of instance?.rootNodes ?? []) {
    const modelRoot = node as TransformNode
    modelRoot.parent = root
    modelRoot.scaling = new Vector3(CAT_MODEL_SCALE, CAT_MODEL_SCALE, CAT_MODEL_SCALE)
    for (const mesh of modelRoot.getChildMeshes(false)) {
      mesh.metadata = { catIndex: index }
      mesh.isPickable = true
      shadowGenerator.addShadowCaster(mesh)
      meshes.push(mesh)
    }
  }
  hitbox.metadata = { catIndex: index }

  const label = MeshBuilder.CreateTorus(`cat-${index}-marker`, { diameter: 0.84, thickness: 0.025 }, scene)
  label.parent = root
  label.position.y = 1.15
  label.material = materials.marker
  label.isVisible = false

  const cat = {
    root,
    hitbox,
    meshes,
    label,
    animationGroups: instance?.animationGroups ?? [],
    activeAnimation: '',
    activity: 'Walk' as CatActivity,
    nextActivityAt: nextActivityTime(),
    infected,
    alive: true,
    speed: infected ? 0.035 : 0.015 + Math.random() * 0.012,
    target: randomPoint(),
  }

  if (infected) {
    playCatAnimation(cat, 'Run')
  } else {
    assignHealthyActivity(cat, performance.now())
  }
  return cat
}

function playCatAnimation(cat: Cat, name: string, loop = true, restart = false) {
  if (cat.activeAnimation === name && !restart) return null

  const nextAnimation = cat.animationGroups.find((group) => group.name.includes(name))
  if (!nextAnimation) return null

  for (const group of cat.animationGroups) {
    group.stop()
  }
  nextAnimation.play(loop)
  cat.activeAnimation = name
  return nextAnimation
}

function randomPoint() {
  return new Vector3(Math.random() * (PLAY_LIMIT * 2) - PLAY_LIMIT, 0, Math.random() * (PLAY_LIMIT * 2) - PLAY_LIMIT)
}

function nextActivityTime(now = performance.now()) {
  return now + MIN_ACTIVITY_TIME + Math.random() * (MAX_ACTIVITY_TIME - MIN_ACTIVITY_TIME)
}

function pickHealthyActivity() {
  const totalWeight = CAT_ACTIVITY_WEIGHTS.reduce((total, activity) => total + activity.weight, 0)
  let roll = Math.random() * totalWeight

  for (const activity of CAT_ACTIVITY_WEIGHTS) {
    roll -= activity.weight
    if (roll <= 0) return activity.name
  }

  return CAT_ACTIVITY_WEIGHTS[CAT_ACTIVITY_WEIGHTS.length - 1].name
}

function assignHealthyActivity(cat: Cat, now: number) {
  cat.activity = pickHealthyActivity()
  cat.nextActivityAt = nextActivityTime(now)
  playCatAnimation(cat, cat.activity)
  if (cat.activity === 'Walk') {
    cat.target = randomPoint()
  }
}

function updateHealthyActivity(cat: Cat, now: number) {
  if (now < cat.nextActivityAt) return
  assignHealthyActivity(cat, now)
}

function updateKittyCount() {
  const aliveHealthy = cats.filter((cat) => cat.alive && !cat.infected).length
  const aliveInfected = cats.filter((cat) => cat.alive && cat.infected).length
  kittyCount.textContent = `Healthy: ${aliveHealthy} | Infected: ${aliveInfected}`
}

function endGame(message: string) {
  running = false
  statusText.textContent = message
  restartButton.hidden = false
  document.exitPointerLock()
}

function killCat(cat: Cat) {
  cat.alive = false
  cat.hitbox.setEnabled(false)
  playCatAnimation(cat, 'Death', false)
  for (const mesh of cat.meshes) {
    if (mesh !== cat.hitbox) {
      mesh.material = materials.dead
    }
  }
  updateKittyCount()

  const aliveInfected = cats.some((candidate) => candidate.alive && candidate.infected)
  const aliveCats = cats.some((candidate) => candidate.alive)
  if (!aliveInfected) {
    endGame('All infected cats neutralized')
  } else if (!aliveCats) {
    endGame('No cats survived')
  }
}

function infectCat(cat: Cat) {
  if (cat.infected || !cat.alive) return
  cat.infected = true
  cat.speed = 0.035
  cat.target = randomPoint()
  cat.activity = 'Walk'
  cat.nextActivityAt = Number.POSITIVE_INFINITY
  playCatAnimation(cat, 'Run')
  statusText.textContent = 'The infection spread by contact'
  updateKittyCount()
}

function shoot() {
  const now = performance.now()
  if (!running || now - lastShot < SHOT_COOLDOWN) return
  lastShot = now

  const ray = camera.getForwardRay(1)
  const direction = ray.direction.normalize()
  const bullet = MeshBuilder.CreateSphere(`bullet-${now}`, { diameter: 0.14, segments: 8 }, scene)
  bullet.position = camera.position.add(direction.scale(0.9)).add(new Vector3(0, -0.18, 0))
  bullet.material = materials.bullet
  bullets.push({
    mesh: bullet,
    velocity: direction.scale(BULLET_SPEED),
    life: BULLET_LIFE,
  })

  if (shotgunRoot) {
    shotgunRoot.position.z = SHOTGUN_RECOIL_Z
    shotgunRoot.rotation.x = SHOTGUN_REST_ROTATION.x - 0.16
    shotgunRoot.rotation.y = SHOTGUN_REST_ROTATION.y + 0.025
    shotgunRoot.rotation.z = SHOTGUN_REST_ROTATION.z + (Math.random() - 0.5) * 0.06
  }
  showMuzzleEffects(direction)
}

function updateBullets(deltaMs: number) {
  for (let index = bullets.length - 1; index >= 0; index -= 1) {
    const bullet = bullets[index]
    bullet.mesh.position.addInPlace(bullet.velocity)
    bullet.life -= deltaMs

    const hitCat = cats.find((cat) => cat.alive && bullet.mesh.intersectsMesh(cat.hitbox, false))
    if (hitCat) {
      killCat(hitCat)
      bullet.mesh.dispose()
      bullets.splice(index, 1)
      continue
    }

    if (
      bullet.life <= 0 ||
      Math.abs(bullet.mesh.position.x) > WORLD_SIZE ||
      Math.abs(bullet.mesh.position.z) > WORLD_SIZE
    ) {
      bullet.mesh.dispose()
      bullets.splice(index, 1)
    }
  }
}

function spreadInfectionByTouch() {
  const infectedCats = cats.filter((cat) => cat.alive && cat.infected)
  for (const infected of infectedCats) {
    const touchedCat = cats.find(
      (cat) =>
        cat.alive &&
        !cat.infected &&
        Vector3.Distance(infected.root.position, cat.root.position) <= INFECTION_TOUCH_DISTANCE,
    )
    if (touchedCat) {
      infectCat(touchedCat)
    }
  }

  if (cats.length > 0 && cats.every((cat) => !cat.alive || cat.infected)) {
    endGame('The infection reached every surviving cat')
  }
}

function moveCats() {
  const now = performance.now()
  for (const cat of cats) {
    if (!cat.alive) continue

    if (cat.infected) {
      const victim = cats.find((candidate) => candidate.alive && !candidate.infected)
      if (victim) {
        cat.target = victim.root.position.clone()
      }
    } else {
      updateHealthyActivity(cat, now)
      if (cat.activity !== 'Walk') continue
    }

    const delta = cat.target.subtract(cat.root.position)
    if (delta.length() < 0.3) {
      cat.target = randomPoint()
      continue
    }

    const step = delta.normalize().scale(cat.speed)
    cat.root.position.addInPlace(step)
    cat.root.rotation.y = Math.atan2(-step.x, -step.z)
  }

  spreadInfectionByTouch()
}

canvas.addEventListener('click', () => {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock()
    return
  }

  shoot()
})

restartButton.addEventListener('click', resetGame)

async function init() {
  statusText.textContent = 'Loading models'
  const [loadedCat] = await Promise.all([
    SceneLoader.LoadAssetContainerAsync('/', 'cat.glb', scene),
    attachShotgun(),
    placeWorldMedia(),
  ])
  catModel = loadedCat
  resetGame()
}

void init()

engine.runRenderLoop(() => {
  const deltaMs = engine.getDeltaTime()
  if (running) {
    moveCats()
    updateBullets(deltaMs)
  }
  if (shotgunRoot) {
    shotgunRoot.position.z += (SHOTGUN_REST_Z - shotgunRoot.position.z) * 0.24
    shotgunRoot.rotation.x += (SHOTGUN_REST_ROTATION.x - shotgunRoot.rotation.x) * 0.22
    shotgunRoot.rotation.y += (SHOTGUN_REST_ROTATION.y - shotgunRoot.rotation.y) * 0.22
    shotgunRoot.rotation.z += (SHOTGUN_REST_ROTATION.z - shotgunRoot.rotation.z) * 0.22
  }
  if (muzzleFlashLife > 0) {
    muzzleFlashLife -= deltaMs
    const flashScale = Math.max(0, muzzleFlashLife / 70)
    muzzleFlash.scaling.x = flashScale * 2.4
    muzzleFlash.scaling.y = flashScale
    muzzleFlash.scaling.z = flashScale * 2.4
    muzzleFlash.rotation.z += 0.9
    muzzleFlash.isVisible = muzzleFlashLife > 0
  }
  camera.position.x = Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, camera.position.x))
  camera.position.z = Math.max(-PLAY_LIMIT, Math.min(PLAY_LIMIT, camera.position.z))
  camera.position.y = 1.7
  scene.render()
})

window.addEventListener('resize', () => engine.resize())
}
