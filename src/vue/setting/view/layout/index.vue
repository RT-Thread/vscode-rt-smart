<template>
  <div class="common-layout">
    <Banner sub-title="设置" />

      <el-aside>
        <el-menu
          :collapse="isSidebarOpen"
          :collapse-transition="false"
          router
          :default-active="defaultActive"
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
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { routes } from '../../router';
import { extensionInfo } from '../../data';
import { imgUrl } from '../../../assets/img'
import Banner from '../../../components/Banner.vue';

interface MenuRoute {
  path: string
  redirect?: string
  children: any
  meta: any
}

const route = useRoute()
const router = useRouter()
const isSidebarOpen = ref(false)

type ListItemType = MenuRoute & { icon?: string }
const list: any = computed(() => {
  return getMenuList(routes)
})

// 使用 ref 来存储当前激活的菜单项
const activeMenu = ref('')

// 计算默认激活的菜单项
const defaultActive = computed(() => {
  return activeMenu.value || route.path || '/environment'
})

// 在组件挂载后设置默认激活菜单
onMounted(() => {
  // 如果当前路径是根路径或没有路径，设置为环境工具
  if (!route.path || route.path === '/') {
    activeMenu.value = '/environment'
    // 确保路由也跳转到环境工具
    router.push('/environment')
  } else {
    activeMenu.value = route.path
  }
})

// 监听路由变化，同步更新激活菜单
watch(() => route.path, (newPath) => {
  if (newPath) {
    activeMenu.value = newPath
  }
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
