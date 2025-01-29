<template>
  <div class="common-layout">
    <el-container>
      <el-header class="header_box">
        <div class="header_logo">
          <img class="logo_img" :src="imgUrl['head-logo']" alt="" />
          <div class="logo_text">
            <p>扩展工具</p>
            <span>v{{ extensionInfo.version }}</span>
          </div>
        </div>
      </el-header>
      <el-aside>
        <el-menu
          :collapse="isSidebarOpen"
          :collapse-transition="false"
          router
          :default-active="$route.path"
          background-color="#fff"
          text-color="#333"
          style="border: none"
          mode="horizontal"
        >
          <el-menu-item
            v-for="item in list"
            :key="item.path"
            :index="item.path"
            :route="item.path"
          >
            <span class="title">{{ item.meta.title }}</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container class="container_main">
        <el-main class="main_box">
          <router-view></router-view>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue'
import { routes } from '../../router';
import { extensionInfo } from '../../data';
import { imgUrl } from '../../../assets/img'

interface MenuRoute {
  path: string
  redirect?: string
  children: any
  meta: any
}

const isSidebarOpen = ref(false)
type ListItemType = MenuRoute & { icon?: string }
const list: any = computed(() => {
  return getMenuList(routes)
})

const getMenuList = (list: MenuRoute[], basePath?: string): ListItemType[] => {
  if (!list || list.length === 0) {
    return []
  }
  list.sort((a, b) => {
    return (a.meta?.orderNo || 0) - (b.meta?.orderNo || 0)
  })
  return list
    .map((item) => {
      const path =
        basePath && !item.path.includes(basePath)
          ? `${basePath}/${item.path}`
          : item.path
      return {
        path,
        title: item.meta?.title,
        icon: item.meta?.icon,
        children: getMenuList(item.children, path),
        meta: item.meta,
        redirect: item.redirect
      }
    })
    .filter((item) => item.meta && item.meta.hidden !== true)
}
</script>

<style scoped>
@import './index.less';
</style>
