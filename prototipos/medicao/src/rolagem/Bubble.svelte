<script lang="ts">
  import type { Message } from './messages'

  let { message }: { message: Message } = $props()
</script>

<div class="msg" class:mine={message.mine}>
  <p>{message.text}</p>
  <span class="time">{message.time}</span>
</div>
