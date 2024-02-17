<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\User;
use Auth;
use DB;
use Illuminate\Http\Request;


class HomeController extends Controller {
    /**
     * Create a new controller instance.
     *
     * @return void
     */
    public function __construct() {
        $this->middleware('auth');
    }

    /**
     * Show the application dashboard.
     *
     * @return \Illuminate\Contracts\Support\Renderable
     */
    public function index(Request $request, $id = null) {
        $messages = [];
        $otherUser = null;
        $user_id = request()->user()->id;
        if ($id) {
            $otherUser = User::findorfail($id);
            $group_id = (Auth::id() > $id) ? Auth::id() . $id : $id . Auth::id();
            $messages = Chat::where('group_id', $group_id)->get()->toArray();
            Chat::where(['user_id' => $id, 'other_user_id' => $user_id, 'is_read' => 0])->update(['is_read' => 1]);
        }
        $friends = User::where('id', '!=', $request->user()->id)->select('*', DB::raw("(SELECT count(id) from chats where chats.other_user_id=$user_id and chats.user_id=users.id and is_read=0) as unread_messages"))->get()->toArray();
        return view('home', compact('friends', 'messages', 'otherUser', 'id'));
    }
}
