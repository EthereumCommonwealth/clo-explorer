'use strict';

const {
  task, watch, dest, series, src,
} = require('gulp');
const eslint = require('gulp-eslint');
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');

sass.compiler = require('node-sass');

task('sass', () => {
  return src('./sass/index.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(autoprefixer({ browsers: ['last 2 versions'], cascade: false }))
    .pipe(dest('./public/styles'));
});

task('lint', () => {
  return src(['*.js', './lib/*.js', './routes/*.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

task('lint:watch', () => {
  watch('./**/*.js', series('lint'));
});

task('sass:watch', () => {
  watch('./sass/index.scss', series('sass'));
});
