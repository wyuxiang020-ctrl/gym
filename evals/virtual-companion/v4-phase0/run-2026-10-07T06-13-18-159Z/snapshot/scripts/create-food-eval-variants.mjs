import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'evals', 'food-ai', 'v1', 'assets', 'generated')

const jobs = [
  {
    input: 'meal-01-chicken-rice-broccoli.png',
    output: 'meal-06-chicken-rice-broccoli-dim.jpg',
    transform: (image) => image.modulate({ brightness: 0.58, saturation: 0.82 }).jpeg({ quality: 68 }),
  },
  {
    input: 'meal-02-oatmeal-fruit-walnuts.png',
    output: 'meal-07-oatmeal-fruit-walnuts-crop.jpg',
    transform: (image) => image.resize(900, 900, { fit: 'cover', position: 'centre' }).jpeg({ quality: 72 }),
  },
  {
    input: 'meal-03-noodles-egg-bokchoy.png',
    output: 'meal-08-noodles-egg-bokchoy-rotated.jpg',
    transform: (image) => image.rotate(7, { background: '#ece8df' }).jpeg({ quality: 75 }),
  },
  {
    input: 'meal-04-yogurt-strawberry-granola.png',
    output: 'meal-09-yogurt-strawberry-granola-compressed.jpg',
    transform: (image) => image.resize({ width: 640 }).jpeg({ quality: 48 }),
  },
  {
    input: 'meal-05-tofu-pepper-brown-rice.png',
    output: 'meal-10-tofu-pepper-brown-rice-crop.jpg',
    transform: (image) => image.resize(820, 820, { fit: 'cover', position: 'centre' }).jpeg({ quality: 70 }),
  },
]

for (const job of jobs) {
  const input = path.join(assets, job.input)
  const output = path.join(assets, job.output)
  await job.transform(sharp(input)).toFile(output)
  console.log(`created ${path.relative(root, output)}`)
}
