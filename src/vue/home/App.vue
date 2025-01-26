<template>
    <div class="container">
      <img class="logo_img" :src="imgUrl['head-logo']" alt="" />
      <h1>Home</h1>
    </div>
  </template>
  
  <script setup lang="ts">
  import { imgUrl } from '../assets/img';
  </script>
  
  <style scoped>
  .container {
    padding: 20px;
  }
  </style>
  