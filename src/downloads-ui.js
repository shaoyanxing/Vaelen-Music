import { ref } from 'vue'

const pickerSong = ref(null)

export function openDownloadPicker(song) {
  pickerSong.value = song
}

export function clearDownloadPicker() {
  pickerSong.value = null
}

export { pickerSong }