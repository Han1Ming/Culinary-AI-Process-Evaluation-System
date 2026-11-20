<script setup lang="ts">
/**
 * 该生录像回放
 * ----------------------------------------------------------------------------
 * 教师没有理由看自己电脑的摄像头——他要看的是**这个学生**那一场。
 * 后端录像流没接通之前，用注册时留的人脸照片做封面帧、配一条可播放的进度条，
 * 至少让「正在看谁的、看到第几秒」这两件事是真的。
 *
 * 接通后把 poster 换成 <video :src="record.videoUrl" poster="..."> 即可，
 * 进度条与时间码直接读 video 的 currentTime / duration，外层不用改。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { RosterStudent } from '@/mock/students'

const props = withDefaults(
  defineProps<{
    student: RosterStudent
    /** 画面来源，如「工位 02 · 正前方」 */
    channel?: string
    /** 录像总时长（秒） */
    duration?: number
    /** 是否显示播放控件：四路小画面里不显示 */
    controls?: boolean
    /** 小尺寸（视频墙里的一格）：收掉控件与外边距 */
    compact?: boolean
  }>(),
  { channel: '工位 · 正前方', duration: 96, controls: true, compact: false },
)

const playing = ref(false)
const position = ref(0)
let timer: number | undefined

const percent = computed(() => Math.min(100, (position.value / props.duration) * 100))

const timeText = computed(() => {
  const fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`
  return `${fmt(position.value)} / ${fmt(props.duration)}`
})

/** 四个分段的刻度：对应签到 / 备菜 / 烹饪 / 装盘 */
const marks = [14, 38, 68, 88]

function stop(): void {
  playing.value = false
  window.clearInterval(timer)
}

function toggle(): void {
  if (playing.value) {
    stop()
    return
  }
  if (position.value >= props.duration) position.value = 0
  playing.value = true
  timer = window.setInterval(() => {
    position.value = Math.min(props.duration, position.value + 0.2)
    if (position.value >= props.duration) stop()
  }, 200)
}

// 换人时进度归零：上一个学生的进度留在新学生身上会读错
watch(
  () => props.student.id,
  () => {
    stop()
    position.value = 0
  },
)

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="stage" :class="{ 'is-compact': compact }">
    <!-- 封面帧：注册时留的人脸照片，模糊后当画面底 -->
    <img v-if="student.facePhoto" class="stage__poster" :src="student.facePhoto" alt="" aria-hidden="true" />
    <div class="stage__scrim" aria-hidden="true" />

    <header class="stage__head">
      <span class="stage__tag">
        <i aria-hidden="true" />
        录像回放
      </span>
      <span class="stage__channel">{{ channel }}</span>
    </header>

    <div class="stage__id">
      <img v-if="student.facePhoto" :src="student.facePhoto" :alt="`${student.name}的人脸照片`" />
      <span v-else class="stage__initial">{{ student.name.slice(0, 1) }}</span>
      <p class="stage__name">{{ student.name }}</p>
      <p class="stage__no num">{{ student.studentNo }} · 工位 {{ student.seat }}</p>
    </div>

    <footer v-if="controls" class="stage__bar">
      <button
        type="button"
        class="stage__play"
        :aria-label="playing ? '暂停回放' : '播放回放'"
        @click="toggle"
      >
        <svg v-if="!playing" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 3.4v9.2L12.4 8 5 3.4Z" fill="currentColor" />
        </svg>
        <svg v-else viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 3.5h2v9H5v-9Zm4 0h2v9H9v-9Z" fill="currentColor" />
        </svg>
      </button>

      <div class="stage__track">
        <div class="stage__fill" :style="{ width: `${percent}%` }" />
        <i
          v-for="mark in marks"
          :key="mark"
          class="stage__mark"
          :style="{ left: `${mark}%` }"
          aria-hidden="true"
        />
      </div>

      <span class="stage__time num">{{ timeText }}</span>
    </footer>
  </div>
</template>

<style scoped lang="scss">
.stage {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  min-height: 300px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 40%, #202127 0%, #0b0c0e 78%);

  // 视频墙里的一格：只留人与标签，控件与外边距全部收掉
  &.is-compact {
    min-height: 0;

    .stage__head {
      padding: 8px 10px;
    }

    .stage__tag {
      font-size: 10px;
    }

    .stage__channel {
      display: none;
    }

    .stage__id img,
    .stage__id .stage__initial {
      width: 34px;
      height: 34px;
    }

    .stage__name {
      margin-top: 6px;
      font-size: 13px;
    }

    .stage__no {
      font-size: 10px;
    }
  }

  &__poster {
    position: absolute;
    inset: -10%;
    width: 120%;
    height: 120%;
    object-fit: cover;
    // 模糊 + 压暗：它只是「当时那一帧」的替身，不该被当成人像展示
    filter: blur(26px) saturate(0.7) brightness(0.5);
  }

  &__scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.42) 0%, rgba(0, 0, 0, 0.1) 40%, rgba(0, 0, 0, 0.62) 100%);
  }

  &__head {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $space-3 $space-4;
  }

  &__tag {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding: 2px 7px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.92);
    background: rgba(255, 255, 255, 0.14);
    border-radius: 3px;
    backdrop-filter: blur(6px);

    i {
      display: block;
      width: 5px;
      height: 5px;
      background: #f87171;
      border-radius: 50%;
      animation: stage-blink 1.6s $ease-standard infinite;
    }
  }

  &__channel {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.62);
  }

  &__id {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0 $space-4;

    img,
    .stage__initial {
      width: 56px;
      height: 56px;
      object-fit: cover;
      border: 2px solid rgba(255, 255, 255, 0.24);
      border-radius: 50%;
    }

    .stage__initial {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: rgba(255, 255, 255, 0.8);
      background: rgba(255, 255, 255, 0.1);
    }
  }

  &__name {
    margin: 10px 0 0;
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.01em;
  }

  &__no {
    margin: 3px 0 0;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.52);
  }

  &__bar {
    position: relative;
    z-index: 1;
    display: flex;
    gap: $space-3;
    align-items: center;
    padding: $space-3 $space-4;
  }

  &__play {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: #fff;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.16);
    border: 0;
    border-radius: 50%;
    transition: background-color $duration-fast $ease-standard;

    &:hover {
      background: rgba(255, 255, 255, 0.26);
    }

    svg {
      width: 14px;
      height: 14px;
    }
  }

  &__track {
    position: relative;
    flex: 1;
    height: 3px;
    background: rgba(255, 255, 255, 0.18);
    border-radius: 2px;
  }

  &__fill {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    background: rgba(255, 255, 255, 0.86);
    border-radius: 2px;
  }

  &__mark {
    position: absolute;
    top: -2px;
    width: 1px;
    height: 7px;
    background: rgba(255, 255, 255, 0.34);
  }

  &__time {
    flex-shrink: 0;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.62);
  }
}

@keyframes stage-blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}
</style>
