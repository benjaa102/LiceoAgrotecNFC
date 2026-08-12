const fs = require('fs')
const pdf = require('pdf-parse')

async function parse() {
  const dataBuffer = fs.readFileSync('./cursos/1°A.pdf')
  const data = await pdf(dataBuffer)
  console.log(data.text)
}
parse()
